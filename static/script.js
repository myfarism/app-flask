async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    const videoElement = document.getElementById("liveVideo")
    if (videoElement) {
      videoElement.srcObject = stream
    }
  } catch (err) {
    console.error("Gagal mengakses kamera:", err)
    alert("Izin kamera dibutuhkan agar live feed tampil")
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Check if user is logged in

  const BASE_API_URL = "http://localhost:5000" 

  const user = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}")
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || null

  if (document.getElementById("liveVideo")) {
    initCamera()
  }

  // Tombol ambil foto
  const captureBtn = document.getElementById("captureBtn");

  if (captureBtn) {
    captureBtn.addEventListener("click", () => {
      const video = document.getElementById("liveVideo");
      const canvas = document.getElementById("snapshotCanvas");
      const context = canvas.getContext("2d");

      // Ambil frame dari video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert ke Base64
      const imageData = canvas.toDataURL("image/jpeg");

      // Tampilkan hasil capture
      const capturedImagePreview = document.getElementById("capturedImagePreview");
      capturedImagePreview.src = imageData;

      // Dapatkan elemen modal dan bagian dataset
      const datasetImage = document.getElementById("datasetImagePreview");
      const welcomeText = document.getElementById("welcome");

      // Reset state modal
      datasetImage.style.display = "none";
      welcomeText.style.display = "none";

      // Tampilkan modal langsung
      const modal = new bootstrap.Modal(document.getElementById("previewModal"));
      modal.show();

      let isSubmitting = false;

      // Tombol Kirim Absensi
      document.getElementById("confirmSubmit").onclick = () => {
        if (isSubmitting) return; 
        isSubmitting = true;

        const btn = document.getElementById("confirmSubmit");
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mengirim...';


        datasetImage.style.display = "none";

        fetch("/api/face-recognition", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${
              localStorage.getItem("token") || sessionStorage.getItem("token")
            }`,
          },
          body: JSON.stringify({ image: imageData }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              alert(`Absensi berhasil: ${data.name} (${data.nim})`);

              // Ketika gambar dataset selesai dimuat
              datasetImage.onload = () => {
                datasetImage.style.display = "block";
                welcomeText.style.display = "block";
                welcomeText.textContent = `Selamat datang, ${data.name} (${data.nim})`;
              };

              datasetImage.onerror = () => {
                alert("Gagal memuat foto dataset.");
              };

              // Muat gambar dataset
              datasetImage.src = `/api/dataset-image/${data.name}_${data.nim}?t=${Date.now()}`;

              btn.innerHTML = '<span></span>Selesai';
              btn.disabled = false;
              
              btn.addEventListener('click', function handleFinishClick() {
                if (btn.innerText.includes('Selesai')) {
                  const modalElement = document.getElementById('previewModal');
                  const modalInstance = bootstrap.Modal.getInstance(modalElement);
                  modalInstance.hide();
                  btn.innerHTML = '<span></span>Kirim Absensi';

                  // Optional: bersihkan listener setelah digunakan
                  btn.removeEventListener('click', handleFinishClick);
                } else {
                  btn.disabled = false;
                  btn.innerHTML = '<span></span>Alamaak2';
                }
              });
              loadTodayAttendance();
            } else {
              alert("Absensi gagal: " + data.message);
            }
          })
          .catch((err) => {
            console.error("Error:", err);
            alert("Terjadi kesalahan pada server.");
          });
      };
    });
  }


  if (!user.id || !token) {
    // Redirect to login page if not logged in or no token
    window.location.href = "/"
    return
  }

  // Add token to all fetch requests
  const originalFetch = window.fetch
  window.fetch = function(url, config = {}) {
    config.headers = {
      ...(config.headers || {}),
      'Authorization': `Bearer ${token}`
    }
    return originalFetch(url, config)
  }


  // Display username in sidebar
  const usernameElement = document.getElementById("username")
  if (usernameElement) {
    usernameElement.textContent = user.name || user.username || "Pengguna"
  }

  // Mobile Sidebar Toggle
  const sidebarToggle = document.getElementById("sidebarToggle")
  const mobileSidebarToggle = document.getElementById("mobileSidebarToggle")
  const sidebar = document.getElementById("sidebar")

  function toggleSidebar() {
    sidebar.classList.toggle("open")
    if (window.innerWidth < 768) {
      if (sidebar.classList.contains("open")) {
        document.body.style.overflow = "hidden"
      } else {
        document.body.style.overflow = ""
      }
    }
  }

  if (sidebarToggle) sidebarToggle.addEventListener("click", toggleSidebar)
  if (mobileSidebarToggle) mobileSidebarToggle.addEventListener("click", toggleSidebar)

  // Close sidebar when clicking outside on mobile
  document.addEventListener("click", (event) => {
    if (
      window.innerWidth < 768 &&
      sidebar &&
      !sidebar.contains(event.target) &&
      sidebarToggle && !sidebarToggle.contains(event.target) &&
      mobileSidebarToggle && !mobileSidebarToggle.contains(event.target) &&
      sidebar.classList.contains("open")
    ) {
      toggleSidebar()
    }
  })

  // Navigation
  const navLinks = document.querySelectorAll(".nav-link")
  const pages = document.querySelectorAll(".page-content")

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault()

      // Remove active class from all links
      navLinks.forEach((navLink) => navLink.classList.remove("active"))

      // Add active class to clicked link
      this.classList.add("active")

      // Hide all pages
      pages.forEach((page) => page.classList.add("hidden"))

      // Show the target page
      const targetId = this.getAttribute("href").substring(1)
      const targetPage = document.getElementById(targetId)
      if (targetPage) {
        targetPage.classList.remove("hidden")
      }

      // Close sidebar on mobile after navigation
      if (window.innerWidth < 768 && sidebar.classList.contains("open")) {
        toggleSidebar()
      }

      // Load page-specific data
      if (targetId === "dashboard") {
        loadTodayAttendance()
        updateDashboardStats()
      } else if (targetId === "riwayat") {
        loadAttendanceHistory()
      } else if (targetId === "profil") {
        loadClassInfo()
      }
    })
  })

  // Initialize Flatpickr Date Picker
  if (typeof flatpickr !== "undefined") {
    const datePickerElement = document.getElementById("datePicker")
    if (datePickerElement) {
      flatpickr(datePickerElement, {
        dateFormat: "Y-m-d",
        onChange: (selectedDates, dateStr) => {
          const selectedDateElement = document.getElementById("selectedDate")
          if (selectedDateElement) {
            selectedDateElement.textContent = formatDate(dateStr)
          }
          loadAttendanceByDate(dateStr)
        },
      })
    }
  }

  // Format date from YYYY-MM-DD to DD/MM/YYYY
  function formatDate(dateStr) {
    if (!dateStr) return "Semua Tanggal"
    const [year, month, day] = dateStr.split("-")
    return `${day}/${month}/${year}`
  }

  // Load today's attendance data
  function loadTodayAttendance() {
    fetch(`/api/attendance/today`, {
      credentials: 'include'
    })
      .then((response) => {
        if (response.status === 401) {
          // Unauthorized, redirect to login
          window.location.href = "/login.html"
          return null
        }
        return response.json()
      })
      .then((data) => {
        if (data && data.success) {
          renderAttendanceTable(data.data, "attendanceTableBody")
          updateDashboardStats()
        } else if (data) {
          console.error("Error loading attendance data:", data.message)
          showTableError("attendanceTableBody", "Gagal memuat data absensi")
        }
      })
      .catch((error) => {
        console.error("Error fetching attendance data:", error)
        showTableError("attendanceTableBody", "Terjadi kesalahan saat memuat data")
      })
  }

  // Load attendance data by date
  function loadAttendanceByDate(date) {
    fetch(`${BASE_API_URL}/api/attendance/date/${date}`, {
      credentials: 'include'
    })
      .then((response) => {
        if (response.status === 401) {
          window.location.href = "/login.html"
          return null
        }
        return response.json()
      })
      .then((data) => {
        if (data && data.success) {
          renderAttendanceTable(data.data, "historyTableBody", true)
        } else if (data) {
          console.error("Error loading attendance data:", data.message)
          showTableError("historyTableBody", "Gagal memuat data absensi", 5)
        }
      })
      .catch((error) => {
        console.error("Error fetching attendance data:", error)
        showTableError("historyTableBody", "Terjadi kesalahan saat memuat data", 5)
      })
  }

  // Load attendance history
  function loadAttendanceHistory() {
    fetch(`${BASE_API_URL}/api/attendance/history`, {
      credentials: 'include'
    })
      .then((response) => {
        if (response.status === 401) {
          window.location.href = "/login.html"
          return null
        }
        return response.json()
      })
      .then((data) => {
        if (data && data.success) {
          renderAttendanceTable(data.data, "historyTableBody", true)
        } else if (data) {
          console.error("Error loading attendance history:", data.message)
          showTableError("historyTableBody", "Gagal memuat riwayat absensi", 5)
        }
      })
      .catch((error) => {
        console.error("Error fetching attendance history:", error)
        showTableError("historyTableBody", "Terjadi kesalahan saat memuat data", 5)
      })
  }

  // Show error in table
  function showTableError(tableBodyId, message, colspan = 4) {
    const tableBody = document.getElementById(tableBodyId)
    if (!tableBody) return

    tableBody.innerHTML = `
      <tr class="hover:bg-gray-50 transition-colors duration-150">
        <td colspan="${colspan}" class="px-6 py-4 text-center text-red-500">
          ${message}
        </td>
      </tr>
    `
  }

  // Render attendance table
  function renderAttendanceTable(data, tableBodyId, showDate = false) {
    const tableBody = document.getElementById(tableBodyId)
    if (!tableBody) return

    tableBody.innerHTML = ""

    if (!data || data.length === 0) {
      const colspan = showDate ? 5 : 4
      const emptyRow = document.createElement("tr")
      emptyRow.className = "hover:bg-gray-50 transition-colors duration-150"
      emptyRow.innerHTML = `
        <td colspan="${colspan}" class="px-6 py-4 text-center text-gray-500">
          Tidak ada data absensi
        </td>
      `
      tableBody.appendChild(emptyRow)
      return
    }

    data.forEach((item) => {
      const row = document.createElement("tr")
      row.className = "hover:bg-gray-50 transition-colors duration-150"

      // Determine if we need to show date column (for history table)
      const dateColumn = showDate
        ? `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(item.date)}</td>`
        : ""

      row.innerHTML = `
        ${dateColumn}
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.nim || 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.name || 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.time || 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            item.status === "Tepat Waktu" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
          }">
            ${item.status || 'N/A'}
          </span>
        </td>
      `
      tableBody.appendChild(row)
    })
  }

  // Update dashboard statistics
  function updateDashboardStats() {
    const classId = 1

    // Get total students count
    fetch(`${BASE_API_URL}/api/class/${classId}/students/count`, {
      credentials: 'include'
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const totalElements = document.querySelectorAll("#totalStudents")
          totalElements.forEach(el => {
            el.textContent = data.count
          })
        }
      })
      .catch((error) => console.error("Error fetching student count:", error))

    // Get today's attendance count
    fetch(`${BASE_API_URL}/api/class/${classId}/attendance/today/count`, {
      credentials: 'include'
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const totalStudentsElement = document.querySelector("#totalStudents")
          const totalStudents = totalStudentsElement ? parseInt(totalStudentsElement.textContent) : 0
          const attendanceCount = data.count
          const percentage = totalStudents > 0 ? Math.round((attendanceCount / totalStudents) * 100) : 0

          const todayElements = document.querySelectorAll("#todayAttendance")
          todayElements.forEach(el => {
            el.textContent = attendanceCount
          })

          const percentageElements = document.querySelectorAll("#attendancePercentage")
          percentageElements.forEach(el => {
            el.textContent = `(${percentage}%)`
          })
        }
      })
      .catch((error) => console.error("Error fetching attendance count:", error))
  }

  // Load class information
  function loadClassInfo() {
    const classId = 1

    fetch(`${BASE_API_URL}/api/class/${classId}`, {
      credentials: 'include'
    })
      .then((response) => {
        if (response.status === 401) {
          window.location.href = "/login.html"
          return null
        }
        return response.json()
      })
      .then((data) => {
        if (data && data.success) {
          const classInfo = data.data

          // Update class details
          const elements = {
            className: classInfo.name,
            classCode: classInfo.code,
            classSemester: classInfo.semester,
            classSKS: classInfo.sks,
            roomName: classInfo.room,
            roomLocation: classInfo.location,
            roomCapacity: `${classInfo.capacity} orang`,
            roomFacilities: classInfo.facilities
          }

          Object.keys(elements).forEach(id => {
            const element = document.getElementById(id)
            if (element) {
              element.textContent = elements[id]
            }
          })
        }
      })
      .catch((error) => console.error("Error fetching class info:", error))
  }

  // Add logout functionality
  const logoutButton = document.getElementById("logoutButton")
  if (logoutButton) {
    logoutButton.addEventListener("click", async (e) => {
      e.preventDefault()

      try {
        // Call logout endpoint
        await fetch(`${BASE_API_URL}/logout`, {
          credentials: 'include'
        })
      } catch (error) {
        console.error("Logout error:", error)
      }

      // Clear user data from storage
      localStorage.removeItem("user")
      sessionStorage.removeItem("user")

      // Redirect to login page
      window.location.href = "/login.html"
    })
  }

  // Add manual attendance form handler
  const addAttendanceForm = document.getElementById("addAttendanceForm")
  if (addAttendanceForm) {
    addAttendanceForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      const nimInput = document.getElementById("nimInput")
      const statusSelect = document.getElementById("statusSelect")

      if (!nimInput || !statusSelect) return

      const nim = nimInput.value
      const status = statusSelect.value

      if (!nim) {
        alert("Silakan masukkan NIM mahasiswa")
        return
      }

      try {
        const response = await fetch(`${BASE_API_URL}/api/attendance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: 'include',
          body: JSON.stringify({
            nim,
            class_id: 1,
            status,
          }),
        })

        const data = await response.json()

        if (data.success) {
          alert("Absensi berhasil ditambahkan")
          nimInput.value = ""
          loadTodayAttendance()
        } else {
          alert(data.message || "Gagal menambahkan absensi")
        }
      } catch (error) {
        console.error("Error adding attendance:", error)
        alert("Terjadi kesalahan saat menambahkan absensi")
      }
    })
  }

  // Set current date in dashboard
  const today = new Date()
  const options = { weekday: "long", day: "numeric", month: "long", year: "numeric" }
  const currentDateElements = document.querySelectorAll("#currentDate")
  currentDateElements.forEach(element => {
    element.textContent = today.toLocaleDateString("id-ID", options)
  })

  // Initial load
  loadTodayAttendance()
  updateDashboardStats()
})