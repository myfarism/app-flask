cat Dockerfile
FROM python:3.10-bullseye

# Install system dependencies untuk dlib, opencv, dan camera access
RUN apt-get update && apt-get install -y \
    cmake \
    build-essential \
    libopencv-dev \
    libboost-all-dev \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglib2.0-0 \
    libgl1-mesa-glx \
    v4l-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements terlebih dahulu untuk caching layer
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh aplikasi
COPY . .

# Expose port Flask
EXPOSE 5000

# Jalankan aplikasi
CMD ["python", "app.py"]