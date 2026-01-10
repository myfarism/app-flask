from flask import Flask, render_template, Response, jsonify, request, session, redirect, url_for, flash, send_from_directory, abort
from flask_cors import CORS
import cv2
import pickle
import numpy as np
from sklearn.svm import SVC
from sklearn.preprocessing import LabelEncoder
import dlib
# import face_recognition
import time
import json
from datetime import datetime
import os
from functools import wraps
import sqlite3
import threading
import base64
from io import BytesIO
from PIL import Image

# Load trained model
try:
    model = pickle.load(open("model/svm_model_fix.pkl", "rb"))
    label_encoder = pickle.load(open("model/label_fix.pkl", "rb"))
    print("Model berhasil dimuat")
except FileNotFoundError:
    print("Model tidak ditemukan. Pastikan file model/svm_model.pkl dan model/label_encoder.pkl ada.")
    model = None
    label_encoder = None

app = Flask(__name__)
app.secret_key = 'attendance_system_secret_key_2025'

CORS(app, supports_credentials=True, origins=["http://localhost:5000", "http://127.0.0.1:5000"])

# Konfigurasi Database
DATABASE = 'absensi.db'
ATTENDANCE_COOLDOWN = 60

# Menyimpan waktu terakhir absensi untuk setiap mahasiswa
last_attendance_time = {}


detector = dlib.get_frontal_face_detector()
sp = dlib.shape_predictor("model\shape_predictor_68_face_landmarks.dat")
facerec = dlib.face_recognition_model_v1("model\dlib_face_recognition_resnet_model_v1.dat")

cap = cv2.VideoCapture(0)

detected_names = set()  # Gunakan set untuk menyimpan nama unik
lock = threading.Lock()  # Menghindari race condition saat update data

# Database helper functions
def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    """Initialize database with required tables"""
    db = get_db()
    cursor = db.cursor()
    
    # Tabel pengguna
    cursor.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Tabel mahasiswa
    cursor.execute('''CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nim TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        class_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (class_id) REFERENCES classes(id)
    )''')
    
    # Tabel kelas
    cursor.execute('''CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        semester TEXT NOT NULL,
        sks INTEGER NOT NULL,
        room TEXT NOT NULL,
        location TEXT NOT NULL,
        capacity INTEGER NOT NULL,
        facilities TEXT NOT NULL,
        start_time TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Tabel absensi
    cursor.execute('''CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        class_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (class_id) REFERENCES classes(id)
    )''')
    
    db.commit()
    insert_sample_data(db)
    db.close()

def insert_sample_data(db):
    """Insert sample data if database is empty"""
    cursor = db.cursor()
    
    # Check if users table has data
    cursor.execute("SELECT COUNT(*) as count FROM users")
    count = cursor.fetchone()[0]
    
    if count == 0:
        # Insert admin user
        cursor.execute('''INSERT INTO users (username, password, name, role) 
                         VALUES ('admin', 'admin123', 'Administrator', 'admin')''')
        
        # Insert sample class
        cursor.execute('''INSERT INTO classes (name, code, semester, sks, room, location, capacity, facilities, start_time) 
                         VALUES ('Pemrograman Web', 'INF305', 'Ganjil 2024/2025', 4, 
                                'Lab B508', 'Gedung B Lantai 5', 40, 'AC, Proyektor, Komputer', '07:30')''')
        
        # Insert sample students
        students = [
            ('⁠2022071028', 'Muhammad Ananta Arya', 1),
            ('2022071031', 'Irvan Nurfauzan Saputra', 1),
            ('2022071044', 'Rekha Inaya Putri', 1),
            ('20222071025', 'Indah Hairunisah', 1),
            ('2022071015', 'Ellyza Hardianty', 1),
            ('2022071068', 'Muhammad Faris Hafizh', 1),
            ('2022071042', 'Anggi Saputri', 1),
            ('2022071010', 'Nazhif Teggar Ranov', 1),
            ('2022071003', 'Fitriyana Nuril Khaqqi,', 1),
            ('2022071060', 'Arellia Agustin', 1),
            ('2022071034', 'John Bryan Khornelius', 1),
            ('2022071052', 'Azkaa Rahiila Hardi', 1),
            ('2022071047', 'Revo Rahmat', 1),
            ('2022011042', 'Nailasyifa Indraini', 1),
            ('2023071068', 'Fadil Muhammad Prasetya', 1)
        ]
        
        for nim, name, class_id in students:
            cursor.execute('INSERT INTO students (nim, name, class_id) VALUES (?, ?, ?)', 
                          (nim, name, class_id))
        
        # Insert sample attendance
        today = datetime.now().date().isoformat()
        yesterday = (datetime.now().date().replace(day=datetime.now().day-1)).isoformat()
        
        # attendance_data = [
        #     (1, 1, today, '07:45:12', 'Tepat Waktu'),
        #     (2, 1, today, '07:52:34', 'Tepat Waktu'),
        #     (3, 1, today, '08:15:07', 'Terlambat'),
        #     (1, 1, yesterday, '08:05:47', 'Terlambat'),
        # ]
        
        # for student_id, class_id, date, time, status in attendance_data:
        #     cursor.execute('''INSERT INTO attendance (student_id, class_id, date, time, status) 
        #                     VALUES (?, ?, ?, ?, ?)''', (student_id, class_id, date, time, status))
        
        db.commit()
        print("Sample data has been inserted.")

# Decorator untuk memerlukan login
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token or not token.startswith('Bearer '):
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
        # Extract token and verify (simplified for example)
        token = token.split(' ')[1]
        if not token:
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
            
        # You might want to verify the token more securely in production
        return f(*args, **kwargs)
    return decorated_function

def send_attendance_to_db(nim, name, status="Tepat Waktu"):
    """Save attendance to database"""
    current_time = time.time()
    
    # Cek cooldown
    if nim in last_attendance_time and current_time - last_attendance_time[nim] < ATTENDANCE_COOLDOWN:
        return False
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Get student_id from NIM
        cursor.execute('SELECT id FROM students WHERE nim = ?', (nim,))
        student = cursor.fetchone()
        
        if not student:
            db.close()
            return False
        
        student_id = student['id']
        date = datetime.now().date().isoformat()
        time_str = datetime.now().time().strftime('%H:%M:%S')
        
        # Check if already attended today
        cursor.execute('SELECT id FROM attendance WHERE student_id = ? AND date = ?', 
                      (student_id, date))
        existing = cursor.fetchone()
        
        if existing:
            db.close()
            return False
        
        # Insert attendance
        cursor.execute('''INSERT INTO attendance (student_id, class_id, date, time, status) 
                         VALUES (?, ?, ?, ?, ?)''', (student_id, 1, date, time_str, status))
        db.commit()
        db.close()
        
        last_attendance_time[nim] = current_time
        print(f"Absensi berhasil: {nim} - {name}")
        return True
        
    except Exception as e:
        print(f"Error mengirim absensi: {str(e)}")
        return False

def gen_frames():
    global detected_names
    while True:
        success, frame = cap.read()
        if not success:
            break
        
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        faces = detector(rgb_frame)
        
        with lock:
            detected_names.clear()
            
            for face in faces:
                shape = sp(rgb_frame, face)
                face_descriptor = facerec.compute_face_descriptor(rgb_frame, shape)
                face_descriptor = np.array(face_descriptor).reshape(1, -1)
                
                # Prediksi pakai SVM
                pred_label = model.predict(face_descriptor)[0]
                pred_name = label_encoder.inverse_transform([pred_label])[0]
                
                # Pisahkan nama dan nim (format: nama_nim)
                nama, nim = "Unknown", "Unknown"
                if "_" in pred_name:
                    parts = pred_name.split("_", 1)
                    if len(parts) == 2:
                        nama, nim = parts[0], parts[1]
                
                detected_names.add(pred_name)
                
                # Gambar bounding box
                x1, y1, x2, y2 = face.left(), face.top(), face.right(), face.bottom()
                
                # Warna hijau untuk wajah dikenali, merah untuk unknown
                color = (0, 255, 0) if nama != "Unknown" else (0, 0, 255)
                
                # Draw rectangle
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                
                # Siapkan text
                text_nama = f"{nama}"
                text_nim = f"NIM: {nim}"
                
                # Ukuran font dan thickness
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.6
                thickness = 2
                
                # Hitung ukuran teks
                (text_width_nama, text_height_nama), _ = cv2.getTextSize(text_nama, font, font_scale, thickness)
                (text_width_nim, text_height_nim), _ = cv2.getTextSize(text_nim, font, font_scale, thickness)
                
                # Background untuk nama
                cv2.rectangle(frame, 
                            (x1, y1 - text_height_nama - 10), 
                            (x1 + text_width_nama + 10, y1), 
                            color, -1)
                
                # Text nama (putih)
                cv2.putText(frame, text_nama, 
                           (x1 + 5, y1 - 5),
                           font, font_scale, (255, 255, 255), thickness)
                
                # Background untuk NIM
                cv2.rectangle(frame, 
                            (x1, y2), 
                            (x1 + text_width_nim + 10, y2 + text_height_nim + 10), 
                            color, -1)
                
                # Text NIM (putih)
                cv2.putText(frame, text_nim, 
                           (x1 + 5, y2 + text_height_nim + 5),
                           font, font_scale, (255, 255, 255), thickness)
                
                # Auto-submit absensi untuk wajah yang dikenali
                if nama != "Unknown" and nim != "Unknown":
                    send_attendance_to_db(nim, nama)
        
        _, buffer = cv2.imencode(".jpg", frame)
        frame_bytes = buffer.tobytes()
        
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")


# Routes
@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM users WHERE username = ? AND password = ?', 
                   (username, password))
    user = cursor.fetchone()
    db.close()
    
    if user:
        session['logged_in'] = True
        session['username'] = user['username']
        session['user_id'] = user['id']
        session['login_time'] = datetime.now().isoformat()
        
        # Generate a simple token (in production use JWT or similar)
        token = f"{user['id']}:{datetime.now().timestamp()}"
        
        return jsonify({
            'success': True,
            'token': token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'name': user['name'],
                'role': user['role']
            }
        })
    else:
        return jsonify({'success': False, 'message': 'Username atau password salah'}), 401

@app.route('/')
def home():
    return render_template('login.html')

@app.route('/index.html')
def index_page():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    # Cek token dari query parameter (untuk img tag) atau header
    token = request.args.get('token') or request.headers.get('Authorization', '')
    
    if token.startswith('Bearer '):
        token = token.split(' ')[1]
    
    if not token:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    # Verifikasi token (simplified)
    # Dalam production, verifikasi token dengan lebih aman
    if not token or len(token) < 5:
        return jsonify({'success': False, 'message': 'Invalid token'}), 401
    
    return Response(gen_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/attendance/today')
@login_required
def get_today_attendance():
    today = datetime.now().date().isoformat()
    
    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT a.id, s.nim, s.name, a.time, a.status
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE a.date = ?
        ORDER BY a.time ASC
    ''', (today,))
    
    rows = cursor.fetchall()
    db.close()
    
    data = [dict(row) for row in rows]
    return jsonify({'success': True, 'data': data})

@app.route('/api/attendance/date/<date>')
@login_required
def get_attendance_by_date(date):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT a.id, s.nim, s.name, a.time, a.status, a.date
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE a.date = ?
        ORDER BY a.time ASC
    ''', (date,))
    
    rows = cursor.fetchall()
    db.close()
    
    data = [dict(row) for row in rows]
    return jsonify({'success': True, 'data': data})

@app.route('/api/attendance/history')
@login_required
def get_attendance_history():
    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT a.id, s.nim, s.name, a.date, a.time, a.status
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        ORDER BY a.date DESC, a.time ASC
        LIMIT 100
    ''')
    
    rows = cursor.fetchall()
    db.close()
    
    data = [dict(row) for row in rows]
    return jsonify({'success': True, 'data': data})

@app.route('/api/class/<int:class_id>')
@login_required
def get_class_info(class_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM classes WHERE id = ?', (class_id,))
    row = cursor.fetchone()
    db.close()
    
    if row:
        return jsonify({'success': True, 'data': dict(row)})
    else:
        return jsonify({'success': False, 'message': 'Kelas tidak ditemukan'}), 404

@app.route('/api/class/<int:class_id>/students/count')
@login_required
def get_students_count(class_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT COUNT(*) as count FROM students WHERE class_id = ?', (class_id,))
    row = cursor.fetchone()
    db.close()
    return jsonify({'success': True, 'count': row['count']})

@app.route('/api/class/<int:class_id>/attendance/today/count')
@login_required
def get_today_attendance_count(class_id):
    today = datetime.now().date().isoformat()
    
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT COUNT(*) as count FROM attendance WHERE class_id = ? AND date = ?', 
                   (class_id, today))
    row = cursor.fetchone()
    db.close()
    
    return jsonify({'success': True, 'count': row['count']})

@app.route('/api/attendance', methods=['POST'])
@login_required
def add_attendance():
    data = request.get_json()
    nim = data.get('nim')
    class_id = data.get('class_id')
    status = data.get('status')
    
    date = datetime.now().date().isoformat()
    time_str = datetime.now().time().strftime('%H:%M:%S')
    
    db = get_db()
    cursor = db.cursor()
    
    # Get student_id
    cursor.execute('SELECT id FROM students WHERE nim = ?', (nim,))
    student = cursor.fetchone()
    
    if not student:
        db.close()
        return jsonify({'success': False, 'message': 'Mahasiswa tidak ditemukan'}), 404
    
    student_id = student['id']
    
    # Check if already attended today
    cursor.execute('SELECT id FROM attendance WHERE student_id = ? AND date = ?', 
                  (student_id, date))
    existing = cursor.fetchone()
    
    if existing:
        db.close()
        return jsonify({'success': False, 'message': 'Mahasiswa sudah melakukan absensi hari ini'}), 400
    
    # Insert attendance
    cursor.execute('''INSERT INTO attendance (student_id, class_id, date, time, status) 
                     VALUES (?, ?, ?, ?, ?)''', (student_id, class_id, date, time_str, status))
    db.commit()
    attendance_id = cursor.lastrowid
    db.close()
    
    return jsonify({
        'success': True,
        'message': 'Absensi berhasil dicatat',
        'data': {
            'id': attendance_id,
            'student_id': student_id,
            'class_id': class_id,
            'date': date,
            'time': time_str,
            'status': status
        }
    })

@app.route('/api/face-recognition', methods=['POST'])
@login_required
def face_recognition_api():
    try:
        data = request.get_json()
        image_data = data.get('image')

        # Hapus prefix data:image/jpeg;base64,
        image_data = image_data.split(",")[1]
        img_bytes = base64.b64decode(image_data)

        # Buka sebagai gambar
        image = Image.open(BytesIO(img_bytes)).convert("RGB")
        frame = np.array(image)

        # Proses face recognition seperti biasa
        faces = detector(frame)
        if not faces:
            return jsonify({"success": False, "message": "Wajah tidak terdeteksi"})

        for face in faces:
            shape = sp(frame, face)
            face_descriptor = facerec.compute_face_descriptor(frame, shape)
            face_descriptor = np.array(face_descriptor).reshape(1, -1)

            pred_label = model.predict(face_descriptor)[0]
            pred_name = label_encoder.inverse_transform([pred_label])[0]

            if "_" in pred_name:
                nama, nim = pred_name.split("_", 1)
                send_attendance_to_db(nim, nama)  # simpan ke DB
                return jsonify({"success": True, "name": nama, "nim": nim})

        return jsonify({"success": False, "message": "Wajah tidak dikenali"})

    except Exception as e:
        print("Error face recognition:", str(e))
        return jsonify({"success": False, "message": str(e)})
    
@app.route('/api/dataset-image/<path:folder_name>')
def get_dataset_image(folder_name):
    base_path = os.path.join('static', 'dataset', folder_name)
    
    if not os.path.exists(base_path):
        return abort(404, description="Folder tidak ditemukan")

    # Cari file gambar pertama
    for filename in os.listdir(base_path):
        if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            return send_from_directory(base_path, filename)

    return abort(404, description="Tidak ada file gambar di folder tersebut")

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

if __name__ == '__main__':
    # Create folders if not exist
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    os.makedirs('model', exist_ok=True)
    
    # Initialize database
    init_db()
    
    app.run(debug=True, host='0.0.0.0', port=5000)