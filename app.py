"""
CataCuti Learning App - Backend API
Production-ready Flask application with PostgreSQL support
"""

import os
import json
import uuid
from datetime import datetime
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

# Try to import SQLAlchemy, fallback to sqlite3 if not available
try:
    from flask_sqlalchemy import SQLAlchemy
    from sqlalchemy.orm import DeclarativeBase
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False
    import sqlite3

# Initialize Flask app
app = Flask(__name__, static_folder='.', static_url_path='')

# Configure CORS
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Database Configuration
if SQLALCHEMY_AVAILABLE:
    class Base(DeclarativeBase):
        pass
    
    db = SQLAlchemy(model_class=Base)
    
    # Get database URL
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        # Use SQLite for local development
        database_url = 'sqlite:///cata_cuti.db'
    elif database_url.startswith("postgres://"):
        # Fix for Render's PostgreSQL URL
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_recycle': 300,
        'pool_pre_ping': True,
    }
    
    db.init_app(app)
    
    # Define Models
    class User(db.Model):
        __tablename__ = 'users'
        id = db.Column(db.Integer, primary_key=True)
        email = db.Column(db.String(120), unique=True, nullable=False)
        password = db.Column(db.String(200), nullable=False)
        name = db.Column(db.String(100))
        user_class = db.Column(db.String(50))
        gender = db.Column(db.String(20))
        school = db.Column(db.String(200))
        role = db.Column(db.String(20), default='student')
        created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    class Content(db.Model):
        __tablename__ = 'content'
        id = db.Column(db.Integer, primary_key=True)
        title = db.Column(db.String(200), nullable=False)
        description = db.Column(db.Text)
        subject = db.Column(db.String(100), nullable=False)
        chapter = db.Column(db.String(100))
        content_type = db.Column(db.String(50), nullable=False)
        difficulty = db.Column(db.String(20), default='beginner')
        classes = db.Column(db.Text, default='6th Grade,7th Grade,8th Grade,9th Grade,10th Grade')
        video_url = db.Column(db.String(500))
        notes = db.Column(db.Text)
        files = db.Column(db.Text)
        created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    class Progress(db.Model):
        __tablename__ = 'progress'
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, nullable=False)
        subject = db.Column(db.String(100), nullable=False)
        chapter = db.Column(db.String(100), nullable=False)
        score = db.Column(db.Integer, default=0)
        completed = db.Column(db.Boolean, default=False)
        last_accessed = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    class Streak(db.Model):
        __tablename__ = 'streaks'
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, nullable=False, unique=True)
        current_streak = db.Column(db.Integer, default=0)
        longest_streak = db.Column(db.Integer, default=0)
        last_activity = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Initialize database
    with app.app_context():
        db.create_all()
        
        # Add sample data if tables are empty
        if User.query.count() == 0:
            admin_user = User(
                email="admin@catacuti.com",
                password=generate_password_hash("admin123"),
                name="Admin User",
                user_class="Administrator",
                role="admin"
            )
            db.session.add(admin_user)
            db.session.commit()
            
            test_user = User(
                email="student@catacuti.com",
                password=generate_password_hash("student123"),
                name="Test Student",
                user_class="10th Grade",
                role="student"
            )
            db.session.add(test_user)
            db.session.commit()
        
        if Content.query.count() == 0:
            sample_content = [
                Content(
                    title="Mathematics Basics",
                    description="Introduction to basic math concepts",
                    subject="Mathematics",
                    chapter="Chapter 1",
                    content_type="notes",
                    difficulty="beginner",
                    classes="6th Grade,7th Grade",
                    notes="# Welcome to Mathematics!\n\n## Basic Concepts\n- Addition\n- Subtraction\n- Multiplication\n- Division"
                ),
                Content(
                    title="Science Fundamentals",
                    description="Learn basic science principles",
                    subject="Science",
                    chapter="Introduction",
                    content_type="notes",
                    difficulty="beginner",
                    classes="6th Grade,7th Grade,8th Grade"
                ),
                Content(
                    title="Algebra Quiz",
                    description="Test your algebra knowledge",
                    subject="Mathematics",
                    chapter="Algebra",
                    content_type="quiz",
                    difficulty="intermediate",
                    classes="8th Grade,9th Grade,10th Grade"
                ),
                Content(
                    title="Physics Video: Motion",
                    description="Understanding motion and forces",
                    subject="Physics",
                    chapter="Motion",
                    content_type="video",
                    difficulty="advanced",
                    classes="9th Grade,10th Grade",
                    video_url="https://www.youtube.com/embed/dQw4w9WgXcQ"
                )
            ]
            db.session.add_all(sample_content)
            db.session.commit()
else:
    # Fallback to SQLite without SQLAlchemy
    def get_db_connection():
        conn = sqlite3.connect('cata_cuti.db')
        conn.row_factory = sqlite3.Row
        return conn
    
    def init_sqlite_db():
        conn = get_db_connection()
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
        
        # Add sample data
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
    
    # Initialize SQLite database
    init_sqlite_db()

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
        if SQLALCHEMY_AVAILABLE:
            # Test database connection
            from sqlalchemy import text
            db.session.execute(text('SELECT 1'))
        
        return create_response(
            data={
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat(),
                "service": "CataCuti Learning App",
                "database": "connected" if SQLALCHEMY_AVAILABLE else "sqlite"
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
@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json()
        if not data:
            return create_response(error="No data provided", status=400)
        
        email = data.get('email', '').strip()
        password = data.get('password', '')
        is_signup = data.get('is_signup', False)
        
        if not email or not password:
            return create_response(error="Email and password are required", status=400)
        
        if SQLALCHEMY_AVAILABLE:
            if is_signup:
                # Check if user exists
                existing_user = User.query.filter_by(email=email).first()
                if existing_user:
                    return create_response(error="User already exists", status=400)
                
                # Create new user
                hashed_password = generate_password_hash(password)
                new_user = User(
                    email=email,
                    password=hashed_password,
                    name=data.get('name', ''),
                    user_class=data.get('class', ''),
                    gender=data.get('gender', ''),
                    school=data.get('school', ''),
                    role='student'
                )
                db.session.add(new_user)
                db.session.commit()
                
                # Create streak record
                streak = Streak(user_id=new_user.id)
                db.session.add(streak)
                db.session.commit()
                
                user = new_user
            else:
                # Login existing user
                user = User.query.filter_by(email=email).first()
                if not user or not check_password_hash(user.password, password):
                    return create_response(error="Invalid credentials", status=401)
                
                # Update streak
                update_streak(user.id)
        else:
            # SQLite implementation
            conn = get_db_connection()
            cursor = conn.cursor()
            
            if is_signup:
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
                conn.close()
                
                # Get user data
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
                user = cursor.fetchone()
            else:
                cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
                user = cursor.fetchone()
                
                if not user or not check_password_hash(user['password'], password):
                    conn.close()
                    return create_response(error="Invalid credentials", status=401)
                
                # Update streak
                update_streak_sqlite(user['id'])
            
            conn.close()
        
        # Prepare user response
        user_data = {
            'id': user.id if SQLALCHEMY_AVAILABLE else user['id'],
            'email': user.email if SQLALCHEMY_AVAILABLE else user['email'],
            'name': user.name if SQLALCHEMY_AVAILABLE else user['name'],
            'class': user.user_class if SQLALCHEMY_AVAILABLE else user['user_class'],
            'school': user.school if SQLALCHEMY_AVAILABLE else user['school'],
            'role': user.role if SQLALCHEMY_AVAILABLE else user['role']
        }
        
        return create_response(
            data=user_data,
            message="Registration successful" if is_signup else "Login successful"
        )
        
    except Exception as e:
        return create_response(error=str(e), status=500)

def update_streak(user_id):
    """Update streak for SQLAlchemy"""
    try:
        streak = Streak.query.filter_by(user_id=user_id).first()
        if not streak:
            streak = Streak(user_id=user_id)
            db.session.add(streak)
        
        today = datetime.utcnow()
        last_activity = streak.last_activity
        
        if last_activity:
            days_diff = (today.date() - last_activity.date()).days
            if days_diff == 1:
                streak.current_streak += 1
            elif days_diff > 1:
                streak.current_streak = 1
        else:
            streak.current_streak = 1
        
        if streak.current_streak > streak.longest_streak:
            streak.longest_streak = streak.current_streak
        
        streak.last_activity = today
        db.session.commit()
    except Exception as e:
        db.session.rollback()

def update_streak_sqlite(user_id):
    """Update streak for SQLite"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM streaks WHERE user_id = ?", (user_id,))
        streak = cursor.fetchone()
        
        today = datetime.utcnow()
        
        if streak:
            last_activity = datetime.fromisoformat(streak['last_activity'].replace('Z', '+00:00'))
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
        
        if SQLALCHEMY_AVAILABLE:
            query = Content.query
            
            if subject and subject != 'all':
                query = query.filter(Content.subject == subject)
            
            if content_type and content_type != 'all':
                query = query.filter(Content.content_type == content_type)
            
            if class_filter:
                query = query.filter(Content.classes.contains(class_filter))
            
            content_items = query.order_by(Content.created_at.desc()).all()
            
            content_list = []
            for item in content_items:
                content_data = {
                    'id': item.id,
                    'title': item.title,
                    'description': item.description,
                    'subject': item.subject,
                    'chapter': item.chapter,
                    'content_type': item.content_type,
                    'difficulty': item.difficulty,
                    'classes': item.classes,
                    'video_url': item.video_url,
                    'notes': item.notes,
                    'created_at': item.created_at.isoformat()
                }
                content_list.append(content_data)
        else:
            # SQLite implementation
            conn = get_db_connection()
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
        if SQLALCHEMY_AVAILABLE:
            content = Content.query.get(content_id)
            if not content:
                return create_response(error="Content not found", status=404)
            
            content_data = {
                'id': content.id,
                'title': content.title,
                'description': content.description,
                'subject': content.subject,
                'chapter': content.chapter,
                'content_type': content.content_type,
                'difficulty': content.difficulty,
                'classes': content.classes,
                'video_url': content.video_url,
                'notes': content.notes,
                'files': json.loads(content.files) if content.files else [],
                'created_at': content.created_at.isoformat()
            }
        else:
            conn = get_db_connection()
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
@app.route('/api/progress', methods=['POST', 'OPTIONS'])
def update_progress():
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json()
        if not data:
            return create_response(error="No data provided", status=400)
        
        user_id = data.get('user_id')
        if not user_id:
            return create_response(error="User ID is required", status=400)
        
        if SQLALCHEMY_AVAILABLE:
            progress = Progress(
                user_id=user_id,
                subject=data['subject'],
                chapter=data['chapter'],
                score=data.get('score', 0),
                completed=data.get('completed', False)
            )
            db.session.add(progress)
            db.session.commit()
        else:
            conn = get_db_connection()
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
        if SQLALCHEMY_AVAILABLE:
            progress_items = Progress.query.filter_by(user_id=user_id).all()
            
            progress_list = []
            for item in progress_items:
                progress_data = {
                    'id': item.id,
                    'user_id': item.user_id,
                    'subject': item.subject,
                    'chapter': item.chapter,
                    'score': item.score,
                    'completed': item.completed,
                    'last_accessed': item.last_accessed.isoformat()
                }
                progress_list.append(progress_data)
        else:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM progress WHERE user_id = ?", (user_id,))
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
        if SQLALCHEMY_AVAILABLE:
            streak = Streak.query.filter_by(user_id=user_id).first()
            
            if streak:
                streak_data = {
                    'current_streak': streak.current_streak,
                    'longest_streak': streak.longest_streak,
                    'last_activity': streak.last_activity.isoformat()
                }
            else:
                streak_data = {
                    'current_streak': 0,
                    'longest_streak': 0,
                    'last_activity': datetime.utcnow().isoformat()
                }
        else:
            conn = get_db_connection()
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
                    'last_activity': datetime.utcnow().isoformat()
                }
        
        return create_response(data=streak_data)
        
    except Exception as e:
        return create_response(error=str(e), status=500)

# Admin Endpoints
@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    try:
        if SQLALCHEMY_AVAILABLE:
            total_users = User.query.count()
            total_content = Content.query.count()
            
            # Count active users (users with progress in last 7 days)
            week_ago = datetime.utcnow() - timedelta(days=7)
            active_users = Progress.query.filter(
                Progress.last_accessed >= week_ago
            ).distinct(Progress.user_id).count()
            
            # Calculate completion rate
            total_progress = Progress.query.count()
            completed_progress = Progress.query.filter_by(completed=True).count()
            completion_rate = round(
                (completed_progress / total_progress * 100) if total_progress > 0 else 0, 
                2
            )
        else:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM users")
            total_users = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM content")
            total_content = cursor.fetchone()[0]
            
            # Active users (last 7 days)
            cursor.execute("""
                SELECT COUNT(DISTINCT user_id) 
                FROM progress 
                WHERE last_accessed >= datetime('now', '-7 days')
            """)
            active_users = cursor.fetchone()[0]
            
            # Completion rate
            cursor.execute("SELECT COUNT(*) FROM progress")
            total_progress = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM progress WHERE completed = 1")
            completed_progress = cursor.fetchone()[0]
            
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
        if SQLALCHEMY_AVAILABLE:
            users = User.query.all()
            users_list = []
            for user in users:
                users_list.append({
                    'id': user.id,
                    'email': user.email,
                    'name': user.name,
                    'class': user.user_class,
                    'school': user.school,
                    'role': user.role,
                    'created_at': user.created_at.isoformat()
                })
        else:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users")
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

# File Upload Endpoint
@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return create_response(error="No file uploaded", status=400)
        
        file = request.files['file']
        if file.filename == '':
            return create_response(error="No file selected", status=400)
        
        # Create uploads directory if it doesn't exist
        upload_dir = Path(app.config['UPLOAD_FOLDER'])
        upload_dir.mkdir(exist_ok=True)
        
        # Generate unique filename
        filename = f"{uuid.uuid4().hex}_{file.filename}"
        filepath = upload_dir / filename
        
        # Save file
        file.save(str(filepath))
        
        return create_response(
            data={
                'filename': filename,
                'original_name': file.filename,
                'url': f'/uploads/{filename}',
                'size': filepath.stat().st_size
            },
            message="File uploaded successfully"
        )
        
    except Exception as e:
        return create_response(error=str(e), status=500)

@app.route('/uploads/<filename>')
def serve_uploaded_file(filename):
    try:
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    except Exception as e:
        return create_response(error="File not found", status=404)

# Serve Static Files
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

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

# Initialize uploads directory
if __name__ == '__main__':
    # Create uploads directory
    upload_dir = Path('uploads')
    upload_dir.mkdir(exist_ok=True)
    
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)