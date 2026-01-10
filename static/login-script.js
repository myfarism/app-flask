document.addEventListener("DOMContentLoaded", () => {

  const BASE_API_URL = "http://localhost:5000" 

  const togglePassword = document.getElementById("togglePassword")
  const passwordInput = document.getElementById("password")
  const eyeIcon = document.getElementById("eyeIcon")
  const eyeOffIcon = document.getElementById("eyeOffIcon")

  // Toggle Password Visibility
  togglePassword.addEventListener("click", () => {
    if (passwordInput.type === "password") {
      passwordInput.type = "text"
      eyeIcon.classList.add("hidden")
      eyeOffIcon.classList.remove("hidden")
    } else {
      passwordInput.type = "password"
      eyeIcon.classList.remove("hidden")
      eyeOffIcon.classList.add("hidden")
    }
  })

  // Form Validation
  const loginForm = document.getElementById("loginForm")
  const loginError = document.getElementById("loginError")
  const loginButton = document.getElementById("loginButton")
  const loginSpinner = document.getElementById("loginSpinner")
  const loginText = document.getElementById("loginText")

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault()

    const username = document.getElementById("username").value
    const password = document.getElementById("password").value
    const remember = document.getElementById("remember").checked

    // Basic validation
    if (!username || !password) {
      showError("Silakan isi semua field yang diperlukan")
      return
    }

    // Show loading state
    setLoading(true)

    try {
      // Send login request to Flask server
      const response = await fetch(`${BASE_API_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include', // Penting untuk session cookies
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()
      console.log('Response:', data)

      if (data.success) {
        // Store user data and token in localStorage or sessionStorage based on "remember me"
        const storage = remember ? localStorage : sessionStorage
        storage.setItem("user", JSON.stringify(data.user))
        storage.setItem("token", data.token)  // Save the token

        // Show success message
        showSuccess("Login berhasil! Mengalihkan...")
        
        // Redirect to index.html after successful login
        setTimeout(() => {
          window.location.href = "/index.html"
        }, 500)
      } else {
        showError(data.message || "Login gagal. Silakan coba lagi.")
        setLoading(false)
      }
    } catch (error) {
      console.error("Login error:", error)
      showError("Terjadi kesalahan saat login. Pastikan server Flask berjalan.")
      setLoading(false)
    }
  })

  function showError(message) {
    loginError.textContent = message
    loginError.classList.remove("hidden")
    loginError.classList.remove("bg-green-100", "text-green-700")
    loginError.classList.add("bg-red-100", "text-red-700")

    // Hide error after 5 seconds
    setTimeout(() => {
      loginError.classList.add("hidden")
    }, 5000)
  }

  function showSuccess(message) {
    loginError.textContent = message
    loginError.classList.remove("hidden")
    loginError.classList.remove("bg-red-100", "text-red-700")
    loginError.classList.add("bg-green-100", "text-green-700")
  }

  function setLoading(isLoading) {
    if (isLoading) {
      loginButton.disabled = true
      loginSpinner.classList.remove("hidden")
      loginText.textContent = "Memproses..."
    } else {
      loginButton.disabled = false
      loginSpinner.classList.add("hidden")
      loginText.textContent = "Masuk"
    }
  }

  // Add animation to form inputs
  const formInputs = document.querySelectorAll("input")

  formInputs.forEach((input) => {
    // Add focus animation
    input.addEventListener("focus", () => {
      input.parentElement.classList.add("ring-2", "ring-blue-200")
    })

    // Remove focus animation
    input.addEventListener("blur", () => {
      input.parentElement.classList.remove("ring-2", "ring-blue-200")
    })
  })

  // Check if already logged in
  const user = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}")
  if (user.id && window.location.pathname === "/") {
    window.location.href = "/index.html"
  }

})