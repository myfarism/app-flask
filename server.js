const express = require("express")
const path = require("path")
const sqlite3 = require("sqlite3").verbose()
const bodyParser = require("body-parser")
const cors = require('cors')



// Inisialisasi aplikasi Express
const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, ".")))

// Koneksi ke database SQLite
const db = new sqlite3.Database("./absensi.db", (err) => {
  if (err) {
    console.error("Error connecting to database:", err.message)
  } else {
    console.log("Connected to the SQLite database.")
    initializeDatabase()
  }
})

// Inisialisasi database dengan tabel yang diperlukan
function initializeDatabase() {
  db.serialize(() => {
    // Tabel pengguna
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)

    // Tabel mahasiswa
    db.run(`CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nim TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      class_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )`)

    // Tabel kelas
    db.run(`CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      semester TEXT NOT NULL,
      sks INTEGER NOT NULL,
      room TEXT NOT NULL,
      location TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      facilities TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)

    // Tabel absensi
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )`)

    // Tambahkan data contoh jika database kosong
    insertSampleData()
  })
}

// Fungsi untuk menambahkan data contoh
function insertSampleData() {
  // Cek apakah sudah ada data di tabel users
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (err) {
      console.error(err.message)
      return
    }

    // Jika belum ada data, tambahkan data contoh
    if (row.count === 0) {
      // Tambahkan user admin
      db.run(`INSERT INTO users (username, password, name, role) 
              VALUES ('admin', 'admin123', 'Administrator', 'admin')`)

      // Tambahkan kelas contoh
      db.run(`INSERT INTO classes (name, code, semester, sks, room, location, capacity, facilities) 
              VALUES ('Pemrograman Web Lanjut', 'PWL-2025', 'Genap 2024/2025', 3, 'Lab Komputer 3', 'Gedung D Lantai 2', 50, 'AC, Proyektor, Komputer')`)

      // Tambahkan beberapa mahasiswa
      const students = [
        { nim: "2023001", name: "Ahmad Rizky", class_id: 1 },
        { nim: "2023002", name: "Siti Nurhaliza", class_id: 1 },
        { nim: "2023003", name: "Budi Santoso", class_id: 1 },
        { nim: "2023004", name: "Dewi Lestari", class_id: 1 },
        { nim: "2023005", name: "Rudi Hartono", class_id: 1 },
      ]

      students.forEach((student) => {
        db.run(`INSERT INTO students (nim, name, class_id) VALUES (?, ?, ?)`, [
          student.nim,
          student.name,
          student.class_id,
        ])
      })

      // Tambahkan data absensi contoh
      const today = new Date().toISOString().split("T")[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
      const dayBefore = new Date(Date.now() - 172800000).toISOString().split("T")[0]

      const attendanceData = [
        { student_id: 1, class_id: 1, date: today, time: "07:45:12", status: "Tepat Waktu" },
        { student_id: 2, class_id: 1, date: today, time: "07:52:34", status: "Tepat Waktu" },
        { student_id: 3, class_id: 1, date: today, time: "08:15:07", status: "Terlambat" },
        { student_id: 4, class_id: 1, date: today, time: "08:22:51", status: "Terlambat" },
        { student_id: 5, class_id: 1, date: today, time: "07:48:22", status: "Tepat Waktu" },
        { student_id: 1, class_id: 1, date: yesterday, time: "08:05:47", status: "Terlambat" },
        { student_id: 3, class_id: 1, date: yesterday, time: "07:58:22", status: "Tepat Waktu" },
        { student_id: 5, class_id: 1, date: dayBefore, time: "07:48:22", status: "Tepat Waktu" },
      ]

      attendanceData.forEach((record) => {
        db.run(`INSERT INTO attendance (student_id, class_id, date, time, status) VALUES (?, ?, ?, ?, ?)`, [
          record.student_id,
          record.class_id,
          record.date,
          record.time,
          record.status,
        ])
      })

      console.log("Sample data has been inserted.")
    }
  })
}

// API Endpoints

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body

  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Database error", error: err.message })
    }

    if (row) {
      // Jangan mengirim password ke client
      const { password, ...userWithoutPassword } = row
      return res.json({ success: true, user: userWithoutPassword })
    } else {
      return res.status(401).json({ success: false, message: "Username atau password salah" })
    }
  })
})

// Mendapatkan data absensi hari ini
app.get("/api/attendance/today", (req, res) => {
  const today = new Date().toISOString().split("T")[0]

  db.all(
    `
    SELECT a.id, s.nim, s.name, a.time, a.status
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE a.date = ?
    ORDER BY a.time ASC
  `,
    [today],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Database error", error: err.message })
      }

      return res.json({ success: true, data: rows })
    },
  )
})

// Mendapatkan data absensi berdasarkan tanggal
app.get("/api/attendance/date/:date", (req, res) => {
  const date = req.params.date

  db.all(
    `
    SELECT a.id, s.nim, s.name, a.time, a.status, a.date
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE a.date = ?
    ORDER BY a.time ASC
  `,
    [date],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Database error", error: err.message })
      }

      return res.json({ success: true, data: rows })
    },
  )
})

// Mendapatkan riwayat absensi
app.get("/api/attendance/history", (req, res) => {
  db.all(
    `
    SELECT a.id, s.nim, s.name, a.date, a.time, a.status
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    ORDER BY a.date DESC, a.time ASC
    LIMIT 100
  `,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Database error", error: err.message })
      }

      return res.json({ success: true, data: rows })
    },
  )
})

// Mendapatkan informasi kelas
app.get("/api/class/:id", (req, res) => {
  const classId = req.params.id

  db.get("SELECT * FROM classes WHERE id = ?", [classId], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Database error", error: err.message })
    }

    if (!row) {
      return res.status(404).json({ success: false, message: "Kelas tidak ditemukan" })
    }

    return res.json({ success: true, data: row })
  })
})

// Mendapatkan jumlah mahasiswa dalam kelas
app.get("/api/class/:id/students/count", (req, res) => {
  const classId = req.params.id

  db.get("SELECT COUNT(*) as count FROM students WHERE class_id = ?", [classId], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Database error", error: err.message })
    }

    return res.json({ success: true, count: row.count })
  })
})

// Mendapatkan jumlah kehadiran hari ini
app.get("/api/class/:id/attendance/today/count", (req, res) => {
  const classId = req.params.id
  const today = new Date().toISOString().split("T")[0]

  db.get("SELECT COUNT(*) as count FROM attendance WHERE class_id = ? AND date = ?", [classId, today], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Database error", error: err.message })
    }

    return res.json({ success: true, count: row.count })
  })
})

// Menambahkan data absensi baru
app.post("/api/attendance", (req, res) => {
  const { nim, class_id, status } = req.body
  const date = new Date().toISOString().split("T")[0]
  const time = new Date().toTimeString().split(" ")[0]

  // Cari student_id berdasarkan NIM
  db.get("SELECT id FROM students WHERE nim = ?", [nim], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Database error", error: err.message })
    }

    if (!row) {
      return res.status(404).json({ success: false, message: "Mahasiswa tidak ditemukan" })
    }

    const student_id = row.id

    // Cek apakah mahasiswa sudah absen hari ini
    db.get("SELECT id FROM attendance WHERE student_id = ? AND date = ?", [student_id, date], (err, existingRow) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Database error", error: err.message })
      }

      if (existingRow) {
        return res.status(400).json({ success: false, message: "Mahasiswa sudah melakukan absensi hari ini" })
      }

      // Tambahkan data absensi baru
      db.run(
        "INSERT INTO attendance (student_id, class_id, date, time, status) VALUES (?, ?, ?, ?, ?)",
        [student_id, class_id, date, time, status],
        function (err) {
          if (err) {
            return res.status(500).json({ success: false, message: "Database error", error: err.message })
          }

          return res.json({
            success: true,
            message: "Absensi berhasil dicatat",
            data: {
              id: this.lastID,
              student_id,
              class_id,
              date,
              time,
              status,
            },
          })
        },
      )
    })
  })
})

// Route untuk halaman utama
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"))
})

// Menangani 404
app.use((req, res) => {
  res.status(404).send("Halaman tidak ditemukan")
})

// Menjalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`)
})

// Menutup koneksi database saat aplikasi berhenti
process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      console.error(err.message)
    }
    console.log("Koneksi database ditutup.")
    process.exit(0)
  })
})
