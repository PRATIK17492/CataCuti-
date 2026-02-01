"""
CataCuti Learning App - Backend API
Minimal working version for Render deployment
"""

import os
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3

# Initialize Flask app
app = Flask(__name__, static_folder='.', static_url_path='')

# Configure CORS
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['DATABASE'] = 'cata_cuti.db'

# Database helper function
def get_db():
    conn = sqlite3.connect(app.config['DATABASE'])
    conn.row_factory = sqlite3.Row
    return conn

# Initialize database
def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT,
            user_class TEXT,
            gender TEXT,
            school TEXT,
            role TEXT DEFAULT 'student',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            subject TEXT NOT NULL,
            chapter TEXT,
            content_type TEXT NOT NULL,
            difficulty TEXT DEFAULT 'beginner',
            classes TEXT DEFAULT '6th Grade,7th Grade,8th Grade,9th Grade,10th Grade',
            video_url TEXT,
            notes TEXT,
            files TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            chapter TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            completed BOOLEAN DEFAULT 0,
            last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS streaks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Add sample data if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO users (email, password, name, user_class, role) VALUES (?, ?, ?, ?, ?)",
            ("admin@catacuti.com", generate_password_hash("admin123"), "Admin User", "Administrator", "admin")
        )
        cursor.execute(
            "INSERT INTO users (email, password, name, user_class, role) VALUES (?, ?, ?, ?, ?)",
            ("student@catacuti.com", generate_password_hash("student123"), "Test Student", "10th Grade", "student")
        )
    
    cursor.execute("SELECT COUNT(*) FROM content")
    if cursor.fetchone()[0] == 0:
        sample_content = [
            ("Mathematics Basics", "Introduction to basic math concepts", "Mathematics", "Chapter 1", "notes", 
             "beginner", "6th Grade,7th Grade", None, "# Welcome to Mathematics!", None),
            ("Science Fundamentals", "Learn basic science principles", "Science", "Introduction", "notes",
             "beginner", "6th Grade,7th Grade,8th Grade", None, "# Science Basics", None),
            ("Algebra Quiz", "Test your algebra knowledge", "Mathematics", "Algebra", "quiz",
             "intermediate", "8th Grade,9th Grade,10th Grade", None, None, None),
            ("Physics Video: Motion", "Understanding motion and forces", "Physics", "Motion", "video",
             "advanced", "9th Grade,10th Grade", "https://www.youtube.com/embed/dQw4w9WgXcQ", None, None)
        ]
        
        for content in sample_content:
            cursor.execute('''
                INSERT INTO content (title, description, subject, chapter, content_type, 
                                   difficulty, classes, video_url, notes, files)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', content)
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

# Helper Functions
def create_response(data=None, message="", success=True, error=None, status=200):
    response = {
        "success": success and error is None,
        "message": message,
        "data": data
    }
    if error:
        response["error"] = error
        response["success"] = False
    return jsonify(response), status

# Health Check Endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        return create_response(
            data={
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "service": "CataCuti Learning App",
                "version": "1.0.0"
            },
            message="Service is running normally"
        )
    except Exception as e:
        return create_response(
            error=str(e),
            message="Service health check failed",
            success=False,
            status=500
        )

# Authentication Endpoints
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data:
            return create_response(error="No data provided", status=400)
        
        email = data.get('email', '').strip()
        password = data.get('password', '')
        is_signup = data.get('is_signup', False)
        
        if not email or not password:
            return create_response(error="Email and password are required", status=400)
        
        conn = get_db()
        cursor = conn.cursor()
        
        if is_signup:
            # Check if user exists
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            if cursor.fetchone():
                conn.close()
                return create_response(error="User already exists", status=400)
            
            hashed_password = generate_password_hash(password)
            cursor.execute('''
                INSERT INTO users (email, password, name, user_class, gender, school, role)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                email,
                hashed_password,
                data.get('name', ''),
                data.get('class', ''),
                data.get('gender', ''),
                data.get('school', ''),
                'student'
            ))
            user_id = cursor.lastrowid
            
            # Create streak record
            cursor.execute(
                "INSERT INTO streaks (user_id) VALUES (?)",
                (user_id,)
            )
            
            conn.commit()
            
            # Get user data
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            user = cursor.fetchone()
        else:
            # Login existing user
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
            
            if not user or not check_password_hash(user['password'], password):
                conn.close()
                return create_response(error="Invalid credentials", status=401)
            
            # Update streak
            update_streak(user['id'])
        
        conn.close()
        
        # Prepare user response
        user_data = {
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'class': user['user_class'],
            'school': user['school'],
            'role': user['role']
        }
        
        return create_response(
            data=user_data,
            message="Registration successful" if is_signup else "Login successful"
        )
        
    except Exception as e:
        return create_response(error=str(e), status=500)

def update_streak(user_id):
    """Update streak for user"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM streaks WHERE user_id = ?", (user_id,))
        streak = cursor.fetchone()
        
        today = datetime.now()
        
        if streak:
            try:
                last_activity = datetime.fromisoformat(streak['last_activity'].replace('Z', '+00:00'))
            except:
                last_activity = today
            
            days_diff = (today.date() - last_activity.date()).days
            
            if days_diff == 1:
                new_streak = streak['current_streak'] + 1
            elif days_diff > 1:
                new_streak = 1
            else:
                new_streak = streak['current_streak']
            
            longest_streak = max(new_streak, streak['longest_streak'])
            
            cursor.execute('''
                UPDATE streaks 
                SET current_streak = ?, longest_streak = ?, last_activity = ?
                WHERE user_id = ?
            ''', (new_streak, longest_streak, today.isoformat(), user_id))
        else:
            cursor.execute('''
                INSERT INTO streaks (user_id, current_streak, longest_streak, last_activity)
                VALUES (?, 1, 1, ?)
            ''', (user_id, today.isoformat()))
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error updating streak: {e}")

# Content Endpoints
@app.route('/api/content', methods=['GET'])
def get_content():
    try:
        subject = request.args.get('subject', 'all')
        content_type = request.args.get('type', 'all')
        class_filter = request.args.get('class', '')
        
        conn = get_db()
        cursor = conn.cursor()
        
        query = "SELECT * FROM content WHERE 1=1"
        params = []
        
        if subject and subject != 'all':
            query += " AND subject = ?"
            params.append(subject)
        
        if content_type and content_type != 'all':
            query += " AND content_type = ?"
            params.append(content_type)
        
        if class_filter:
            query += " AND classes LIKE ?"
            params.append(f'%{class_filter}%')
        
        query += " ORDER BY created_at DESC"
        
        cursor.execute(query, params)
        content_items = cursor.fetchall()
        conn.close()
        
        content_list = []
        for item in content_items:
            content_data = {
                'id': item['id'],
                'title': item['title'],
                'description': item['description'],
                'subject': item['subject'],
                'chapter': item['chapter'],
                'content_type': item['content_type'],
                'difficulty': item['difficulty'],
                'classes': item['classes'],
                'video_url': item['video_url'],
                'notes': item['notes'],
                'created_at': item['created_at']
            }
            content_list.append(content_data)
        
        return create_response(data=content_list)
        
    except Exception as e:
        return create_response(error=str(e), status=500)

@app.route('/api/content/<int:content_id>', methods=['GET'])
def get_content_item(content_id):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM content WHERE id = ?", (content_id,))
        content = cursor.fetchone()
        conn.close()
        
        if not content:
            return create_response(error="Content not found", status=404)
        
        content_data = {
            'id': content['id'],
            'title': content['title'],
            'description': content['description'],
            'subject': content['subject'],
            'chapter': content['chapter'],
            'content_type': content['content_type'],
            'difficulty': content['difficulty'],
            'classes': content['classes'],
            'video_url': content['video_url'],
            'notes': content['notes'],
            'files': json.loads(content['files']) if content['files'] else [],
            'created_at': content['created_at']
        }
        
        return create_response(data=content_data)
        
    except Exception as e:
        return create_response(error=str(e), status=500)

# Progress Endpoints
@app.route('/api/progress', methods=['POST'])
def update_progress():
    try:
        data = request.get_json()
        if not data:
            return create_response(error="No data provided", status=400)
        
        user_id = data.get('user_id')
        if not user_id:
            return create_response(error="User ID is required", status=400)
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO progress (user_id, subject, chapter, score, completed)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            user_id,
            data['subject'],
            data['chapter'],
            data.get('score', 0),
            1 if data.get('completed', False) else 0
        ))
        conn.commit()
        conn.close()
        
        return create_response(message="Progress saved successfully")
        
    except Exception as e:
        return create_response(error=str(e), status=500)

@app.route('/api/progress/<int:user_id>', methods=['GET'])
def get_user_progress(user_id):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM progress WHERE user_id = ? ORDER BY last_accessed DESC", (user_id,))
        progress_items = cursor.fetchall()
        conn.close()
        
        progress_list = []
        for item in progress_items:
            progress_data = {
                'id': item['id'],
                'user_id': item['user_id'],
                'subject': item['subject'],
                'chapter': item['chapter'],
                'score': item['score'],
                'completed': bool(item['completed']),
                'last_accessed': item['last_accessed']
            }
            progress_list.append(progress_data)
        
        return create_response(data=progress_list)
        
    except Exception as e:
        return create_response(error=str(e), status=500)

# Streak Endpoints
@app.route('/api/streak/<int:user_id>', methods=['GET'])
def get_streak_endpoint(user_id):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM streaks WHERE user_id = ?", (user_id,))
        streak = cursor.fetchone()
        conn.close()
        
        if streak:
            streak_data = {
                'current_streak': streak['current_streak'],
                'longest_streak': streak['longest_streak'],
                'last_activity': streak['last_activity']
            }
        else:
            streak_data = {
                'current_streak': 0,
                'longest_streak': 0,
                'last_activity': datetime.now().isoformat()
            }
        
        return create_response(data=streak_data)
        
    except Exception as e:
        return create_response(error=str(e), status=500)

# Admin Endpoints
@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM content")
        total_content = cursor.fetchone()[0]
        
        # Active users (last 7 days)
        cursor.execute("""
            SELECT COUNT(DISTINCT user_id) 
            FROM progress 
            WHERE DATE(last_accessed) >= DATE('now', '-7 days')
        """)
        active_users = cursor.fetchone()[0] or 0
        
        # Completion rate
        cursor.execute("SELECT COUNT(*) FROM progress")
        total_progress = cursor.fetchone()[0] or 0
        
        cursor.execute("SELECT COUNT(*) FROM progress WHERE completed = 1")
        completed_progress = cursor.fetchone()[0] or 0
        
        completion_rate = round(
            (completed_progress / total_progress * 100) if total_progress > 0 else 0, 
            2
        )
        
        conn.close()
        
        stats = {
            'total_users': total_users,
            'active_users': active_users,
            'total_content': total_content,
            'completion_rate': completion_rate
        }
        
        return create_response(data=stats)
        
    except Exception as e:
        return create_response(error=str(e), status=500)

@app.route('/api/admin/users', methods=['GET'])
def get_admin_users():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
        users = cursor.fetchall()
        conn.close()
        
        users_list = []
        for user in users:
            users_list.append({
                'id': user['id'],
                'email': user['email'],
                'name': user['name'],
                'class': user['user_class'],
                'school': user['school'],
                'role': user['role'],
                'created_at': user['created_at']
            })
        
        return create_response(data=users_list)
        
    except Exception as e:
        return create_response(error=str(e), status=500)

# Serve Static Files
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    try:
        return send_from_directory('.', path)
    except:
        return "File not found", 404

# Error Handlers
@app.errorhandler(404)
def not_found_error(error):
    return create_response(
        error="Not found",
        message="The requested resource was not found",
        status=404
    )

@app.errorhandler(500)
def internal_error(error):
    return create_response(
        error="Internal server error",
        message="An unexpected error occurred",
        status=500
    )

# Main entry point
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)