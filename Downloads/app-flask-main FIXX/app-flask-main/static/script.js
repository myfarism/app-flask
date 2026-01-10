// GANTI fungsi initVideoFeed() dengan kode ini:
function initVideoFeed() {
    const videoFeedImg = document.getElementById("videoFeed");
    if (videoFeedImg) {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        
        if (!token) {
            console.error("Token tidak ditemukan");
            videoFeedImg.alt = "Token tidak tersedia";
            return;
        }
        
        // Tambahkan token sebagai query parameter
        videoFeedImg.src = `/video_feed?token=${encodeURIComponent(token)}`;
        
        // Handle error jika video feed gagal
        videoFeedImg.onerror = () => {
            console.error("Gagal memuat video feed");
            videoFeedImg.alt = "Video feed tidak tersedia";
            
            // Coba reload setelah 3 detik
            setTimeout(() => {
                videoFeedImg.src = `/video_feed?token=${encodeURIComponent(token)}&t=${Date.now()}`;
            }, 3000);
        };
        
        console.log("Video feed realtime diinisialisasi");
    }
}


document.addEventListener("DOMContentLoaded", () => {
    const BASE_API_URL = "http://localhost:5000"
    const user = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}")
    const token = localStorage.getItem("token") || sessionStorage.getItem("token") || null

    // Inisialisasi video feed realtime
    if (document.getElementById("videoFeed")) {
        initVideoFeed();
    }


    // HAPUS bagian captureBtn event listener karena tidak diperlukan lagi
    
    if (!user.id || !token) {
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

  if (document.getElementById("dashboard") && !document.getElementById("dashboard").classList.contains("hidden")) {
    loadTodayAttendance();
    updateDashboardStats();
  }

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
    console.log('loadTodayAttendance dipanggil');
    
    fetch(`/api/attendance/today`, { credentials: 'include' })
        .then((response) => {
            if (response.status === 401) {
                window.location.href = "/"
                return null
            }
            return response.json()
        })
        .then((data) => {
            console.log('Response dari /api/attendance/today:', data);
            
            if (data && data.success) {
                console.log('Data absensi hari ini:', data.data);
                renderAttendanceTable(data.data, "attendanceTableBody");
                updateDashboardStats();
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


  // Fungsi untuk update statistik dashboard
  function updateDashboardStats() {
      const classId = 1; // ID kelas default, sesuaikan jika ada multiple class
      
      // Get total students
      fetch(`/api/class/${classId}/students/count`, { credentials: 'include' })
          .then(response => response.json())
          .then(data => {
              if (data.success) {
                  const total = data.count || 0;
                  
                  // Update semua elemen total students
                  document.getElementById('totalStudents').textContent = total;
                  document.getElementById('totalStudentsFooter').textContent = total;
                  
                  console.log('Total mahasiswa:', total);
              }
          })
          .catch(error => {
              console.error('Error fetching total students:', error);
          });
      
      // Get today's attendance count
      fetch(`/api/class/${classId}/attendance/today/count`, { credentials: 'include' })
          .then(response => response.json())
          .then(data => {
              if (data.success) {
                  const present = data.count || 0;
                  
                  // Update semua elemen present today
                  document.getElementById('presentToday').textContent = present;
                  document.getElementById('presentTodayFooter').textContent = present;
                  
                  console.log('Hadir hari ini:', present);
                  
                  // Calculate and update attendance rate
                  calculateAttendanceRate(classId);
              }
          })
          .catch(error => {
              console.error('Error fetching today attendance count:', error);
          });
  }

  // Fungsi untuk menghitung persentase kehadiran
  function calculateAttendanceRate(classId) {
    Promise.all([
        fetch(`/api/class/${classId}/students/count`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/class/${classId}/attendance/today/count`, { credentials: 'include' }).then(r => r.json())
    ])
    .then(([studentsData, attendanceData]) => {
        console.log('Calculate rate:', { studentsData, attendanceData });
        
        const total = studentsData.count || 0;
        const present = attendanceData.count || 0;
        
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;
        
        // Update semua elemen attendance rate
        const attendanceRateEl = document.getElementById('attendanceRate');
        const attendanceRateFooterEl = document.getElementById('attendanceRateFooter');
        
        if (attendanceRateEl) attendanceRateEl.textContent = rate + '%';
        if (attendanceRateFooterEl) attendanceRateFooterEl.textContent = rate + '%';
        
        console.log(`Persentase kehadiran diupdate: ${rate}% (${present}/${total})`);
    })
    .catch(error => {
        console.error('Error calculating attendance rate:', error);
    });
  }

  // Fungsi untuk render tabel absensi
  function renderAttendanceTable(data, tableBodyId, includeDate = false) {
      const tableBody = document.getElementById(tableBodyId);
      
      console.log('renderAttendanceTable called:', {
          tableBodyId: tableBodyId,
          tableBody: tableBody,
          dataLength: data ? data.length : 0
      });
      
      if (!tableBody) {
          console.error(`Element dengan ID '${tableBodyId}' tidak ditemukan!`);
          return;
      }
      
      if (!data || data.length === 0) {
          tableBody.innerHTML = `
              <tr>
                  <td colspan="${includeDate ? 5 : 4}" style="text-align: center; padding: 20px; color: #999;">
                      Belum ada data absensi hari ini
                  </td>
              </tr>
          `;
          return;
      }
      
      let html = '';
      data.forEach(item => {
          const statusClass = item.status === 'Tepat Waktu' ? 'badge-success' : 'badge-warning';
          
          html += `
              <tr>
                  ${includeDate ? `<td>${formatDate(item.date)}</td>` : ''}
                  <td>${item.nim}</td>
                  <td>${item.name}</td>
                  <td>${item.time}</td>
                  <td><span class="badge ${statusClass}">${item.status}</span></td>
              </tr>
          `;
      });
      
      tableBody.innerHTML = html;
      console.log(`Tabel ${tableBodyId} berhasil diupdate dengan ${data.length} baris`);
  }

  // Fungsi untuk format tanggal
  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  // Fungsi untuk show error di tabel
  function showTableError(tableBodyId, message, colspan = 4) {
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) {
        console.error(`Element ${tableBodyId} tidak ditemukan`);
        return;
    }
    
    tableBody.innerHTML = `
        <tr>
            <td colspan="${colspan}" style="text-align: center; padding: 20px; color: #dc3545;">
                <i class="fas fa-exclamation-triangle"></i> ${message}
            </td>
        </tr>
    `;
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
    const classId = 1; // ID kelas default
    
    console.log('updateDashboardStats dipanggil');
    
    // Get total students
    fetch(`/api/class/${classId}/students/count`, { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
            console.log('Total students response:', data);
            if (data.success) {
                const total = data.count || 0;
                
                // Update semua elemen total students
                const totalStudentsEl = document.getElementById('totalStudents');
                const totalStudentsFooterEl = document.getElementById('totalStudentsFooter');
                
                if (totalStudentsEl) totalStudentsEl.textContent = total;
                if (totalStudentsFooterEl) totalStudentsFooterEl.textContent = total;
                
                console.log('Total mahasiswa diupdate:', total);
            }
        })
        .catch(error => {
            console.error('Error fetching total students:', error);
        });
    
    // Get today's attendance count
    fetch(`/api/class/${classId}/attendance/today/count`, { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
            console.log('Today attendance count response:', data);
            if (data.success) {
                const present = data.count || 0;
                
                // Update semua elemen present today
                const presentTodayEl = document.getElementById('presentToday');
                const presentTodayFooterEl = document.getElementById('presentTodayFooter');
                
                if (presentTodayEl) presentTodayEl.textContent = present;
                if (presentTodayFooterEl) presentTodayFooterEl.textContent = present;
                
                console.log('Hadir hari ini diupdate:', present);
                
                // Calculate attendance rate
                calculateAttendanceRate(classId);
            }
        })
        .catch(error => {
            console.error('Error fetching today attendance count:', error);
        });
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
            classSks: classInfo.sks,
            classRoom: classInfo.room,
            roomLocation: classInfo.location,
            classCapacity: `${classInfo.capacity} orang`,
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

  setInterval(() => {
        const dashboardPage = document.getElementById("dashboard");
        
        // Hanya refresh jika halaman dashboard sedang aktif/terlihat
        if (dashboardPage && !dashboardPage.classList.contains("hidden")) {
            loadTodayAttendance();
            updateDashboardStats();
        }
    }, 5000); // 5000 ms = 5 detik
    
    console.log("Auto-refresh attendance diaktifkan (setiap 5 detik)");
})