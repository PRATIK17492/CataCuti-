from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
import json
import os
from datetime import datetime, timedelta
import uuid
from werkzeug.security import generate_password_hash, check_password_hash
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
app = Flask(__name__, static_folder='.', static_url_path='')

# Configure CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ["*"],  # In production, restrict to your domain
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Database Configuration
database_url = os.environ.get('DATABASE_URL', 'sqlite:///cata_cuti.db')

# Fix for Render's PostgreSQL URL format
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SECRET_KEY"] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config["UPLOAD_FOLDER"] = 'uploads'

# Initialize the database
db.init_app(app)

# Define Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    name = db.Column(db.String(100))
    user_class = db.Column(db.String(50))  # Renamed from 'class' to avoid Python keyword
    gender = db.Column(db.String(20))
    school = db.Column(db.String(200))
    role = db.Column(db.String(20), default='student')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    progress = db.relationship('Progress', backref='user', lazy=True, cascade="all, delete-orphan")
    streaks = db.relationship('Streak', backref='user', lazy=True, uselist=False, cascade="all, delete-orphan")

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
    
    # Relationships
    questions = db.relationship('QuizQuestion', backref='content', lazy=True, cascade="all, delete-orphan")

class Progress(db.Model):
    __tablename__ = 'progress'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    chapter = db.Column(db.String(100), nullable=False)
    score = db.Column(db.Integer, default=0)
    completed = db.Column(db.Boolean, default=False)
    last_accessed = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class QuizQuestion(db.Model):
    __tablename__ = 'quiz_questions'
    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, db.ForeignKey('content.id'), nullable=False)
    question = db.Column(db.Text, nullable=False)
    options = db.Column(db.Text, nullable=False)  # JSON string
    correct_answer = db.Column(db.Integer, nullable=False)
    explanation = db.Column(db.Text)

class LiveClass(db.Model):
    __tablename__ = 'live_classes'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    chapter = db.Column(db.String(100))
    teacher = db.Column(db.String(100))
    schedule = db.Column(db.DateTime, nullable=False)
    duration_minutes = db.Column(db.Integer, default=60)
    meeting_link = db.Column(db.String(500))
    status = db.Column(db.String(20), default='scheduled')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Streak(db.Model):
    __tablename__ = 'streaks'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    current_streak = db.Column(db.Integer, default=0)
    longest_streak = db.Column(db.Integer, default=0)
    last_activity = db.Column(db.Date, default=datetime.utcnow().date)

# Create tables
with app.app_context():
    db.create_all()
    
    # Add sample data if tables are empty
    if User.query.count() == 0:
        print("Adding sample admin user...")
        admin_user = User(
            email="admin@catacuti.com",
            password=generate_password_hash("admin123"),
            name="Admin User",
            user_class="Administrator",
            school="CataCuti Academy",
            role="admin"
        )
        db.session.add(admin_user)
        db.session.commit()
    
    if Content.query.count() == 0:
        print("Adding sample content...")
        sample_content = [
            Content(
                title="Mathematics Basics",
                description="Introduction to basic math concepts including addition, subtraction, multiplication, and division.",
                subject="Mathematics",
                chapter="Chapter 1",
                content_type="notes",
                difficulty="beginner",
                classes="6th Grade,7th Grade",
                notes="# Mathematics Basics\n\n## 1. Addition\n- Combining numbers\n- Example: 2 + 3 = 5\n\n## 2. Subtraction\n- Finding the difference\n- Example: 5 - 2 = 3"
            ),
            Content(
                title="Science Quiz",
                description="Test your knowledge of basic science concepts",
                subject="Science",
                chapter="General",
                content_type="quiz",
                difficulty="intermediate",
                classes="8th Grade,9th Grade"
            ),
            Content(
                title="Physics Video Lesson",
                description="Understanding motion, forces, and energy in physics",
                subject="Physics",
                chapter="Chapter 3",
                content_type="video",
                difficulty="advanced",
                classes="10th Grade",
                video_url="https://www.youtube.com/embed/dQw4w9WgXcQ"
            )
        ]
        db.session.add_all(sample_content)
        db.session.commit()
        
        # Add sample quiz questions
        science_quiz = Content.query.filter_by(title="Science Quiz").first()
        if science_quiz:
            questions = [
                QuizQuestion(
                    content_id=science_quiz.id,
                    question="What is the chemical symbol for water?",
                    options=json.dumps(["H2O", "CO2", "O2", "NaCl"]),
                    correct_answer=0,
                    explanation="H2O is the chemical formula for water, consisting of two hydrogen atoms and one oxygen atom."
                ),
                QuizQuestion(
                    content_id=science_quiz.id,
                    question="Which planet is known as the Red Planet?",
                    options=json.dumps(["Mars", "Jupiter", "Venus", "Saturn"]),
                    correct_answer=0,
                    explanation="Mars appears red due to iron oxide (rust) on its surface."
                ),
                QuizQuestion(
                    content_id=science_quiz.id,
                    question="What is the process by which plants make their food?",
                    options=json.dumps(["Photosynthesis", "Respiration", "Transpiration", "Digestion"]),
                    correct_answer=0,
                    explanation="Photosynthesis converts sunlight, water, and carbon dioxide into glucose and oxygen."
                )
            ]
            db.session.add_all(questions)
            db.session.commit()

# Helper Functions
def create_response(data=None, message="", status=200, error=None):
    response = {
        "success": error is None,
        "message": message,
        "data": data
    }
    if error:
        response["error"] = error
    return jsonify(response), status

# Authentication endpoints
@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json()
        if not data:
            return create_response(error="No data provided", status=400)
        
        email = data.get('email')
        password = data.get('password')
        is_signup = data.get('is_signup', False)
        
        if not email or not password:
            return create_response(error="Email and password are required", status=400)
        
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
                name=data.get('name'),
                user_class=data.get('class'),
                gender=data.get('gender'),
                school=data.get('school'),
                role='student'
            )
            db.session.add(new_user)
            db.session.commit()
            
            # Initialize streak
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
        
        user_data = {
            'id': user.id,
            'email': user.email,
            'name': user.name,
            'class': user.user_class,
            'school': user.school,
            'role': user.role
        }
        
        return create_response(
            data=user_data,
            message="Login successful" if not is_signup else "Registration successful"
        )
        
    except Exception as e:
        logging.error(f"Login error: {str(e)}")
        return create_response(error="Server error", status=500)

def update_streak(user_id):
    try:
        streak = Streak.query.filter_by(user_id=user_id).first()
        if not streak:
            streak = Streak(user_id=user_id)
            db.session.add(streak)
        
        today = datetime.utcnow().date()
        last_activity = streak.last_activity
        
        if last_activity:
            days_diff = (today - last_activity).days
            if days_diff == 1:
                # Consecutive day
                streak.current_streak += 1
            elif days_diff > 1:
                # Streak broken
                streak.current_streak = 1
            
            # Update longest streak
            if streak.current_streak > streak.longest_streak:
                streak.longest_streak = streak.current_streak
        else:
            streak.current_streak = 1
            streak.longest_streak = 1
        
        streak.last_activity = today
        db.session.commit()
        
    except Exception as e:
        logging.error(f"Streak update error: {str(e)}")
        db.session.rollback()

# Content endpoints
@app.route('/api/content', methods=['GET'])
def get_content():
    try:
        subject = request.args.get('subject', 'all')
        content_type = request.args.get('type', 'all')
        class_filter = request.args.get('class', '')
        
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
                'created_at': item.created_at.isoformat()
            }
            content_list.append(content_data)
        
        return create_response(data=content_list)
        
    except Exception as e:
        logging.error(f"Get content error: {str(e)}")
        return create_response(error="Failed to load content", status=500)

@app.route('/api/content/<int:content_id>', methods=['GET'])
def get_content_item(content_id):
    try:
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
        
        if content.content_type == 'quiz':
            questions = QuizQuestion.query.filter_by(content_id=content_id).all()
            content_data['questions'] = [
                {
                    'id': q.id,
                    'question': q.question,
                    'options': json.loads(q.options),
                    'correct_answer': q.correct_answer,
                    'explanation': q.explanation
                }
                for q in questions
            ]
        
        return create_response(data=content_data)
        
    except Exception as e:
        logging.error(f"Get content item error: {str(e)}")
        return create_response(error="Failed to load content", status=500)

@app.route('/api/admin/content', methods=['POST'])
def create_content():
    try:
        if request.method == 'OPTIONS':
            return '', 200
        
        data = request.get_json()
        if not data:
            return create_response(error="No data provided", status=400)
        
        # Validate required fields
        required_fields = ['title', 'subject', 'content_type']
        for field in required_fields:
            if field not in data:
                return create_response(error=f"Missing required field: {field}", status=400)
        
        new_content = Content(
            title=data['title'],
            description=data.get('description', ''),
            subject=data['subject'],
            chapter=data.get('chapter', ''),
            content_type=data['content_type'],
            difficulty=data.get('difficulty', 'beginner'),
            classes=data.get('classes', '6th Grade,7th Grade,8th Grade,9th Grade,10th Grade'),
            video_url=data.get('video_url', ''),
            notes=data.get('notes', ''),
            files=json.dumps(data.get('files', [])) if data.get('files') else None
        )
        
        db.session.add(new_content)
        db.session.commit()
        
        # If it's a quiz, add questions
        if data['content_type'] == 'quiz' and 'questions' in data:
            for question_data in data['questions']:
                question = QuizQuestion(
                    content_id=new_content.id,
                    question=question_data['question'],
                    options=json.dumps(question_data['options']),
                    correct_answer=question_data['correct_answer'],
                    explanation=question_data.get('explanation', '')
                )
                db.session.add(question)
        
        db.session.commit()
        
        return create_response(
            data={'id': new_content.id},
            message="Content created successfully"
        )
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Create content error: {str(e)}")
        return create_response(error="Failed to create content", status=500)

# Progress endpoints
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
        
        # Check if progress exists
        progress = Progress.query.filter_by(
            user_id=user_id,
            subject=data['subject'],
            chapter=data['chapter']
        ).first()
        
        if progress:
            progress.score = data.get('score', progress.score)
            progress.completed = data.get('completed', progress.completed)
        else:
            progress = Progress(
                user_id=user_id,
                subject=data['subject'],
                chapter=data['chapter'],
                score=data.get('score', 0),
                completed=data.get('completed', False)
            )
            db.session.add(progress)
        
        db.session.commit()
        
        return create_response(message="Progress updated successfully")
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Update progress error: {str(e)}")
        return create_response(error="Failed to update progress", status=500)

@app.route('/api/progress/<int:user_id>', methods=['GET'])
def get_user_progress(user_id):
    try:
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
        
        return create_response(data=progress_list)
        
    except Exception as e:
        logging.error(f"Get progress error: {str(e)}")
        return create_response(error="Failed to load progress", status=500)

# Live classes endpoints
@app.route('/api/live-classes', methods=['GET'])
def get_live_classes():
    try:
        classes = LiveClass.query.order_by(LiveClass.schedule).all()
        
        classes_list = []
        for cls in classes:
            class_data = {
                'id': cls.id,
                'title': cls.title,
                'subject': cls.subject,
                'chapter': cls.chapter,
                'teacher': cls.teacher,
                'schedule': cls.schedule.isoformat(),
                'duration_minutes': cls.duration_minutes,
                'meeting_link': cls.meeting_link,
                'status': cls.status,
                'created_at': cls.created_at.isoformat()
            }
            classes_list.append(class_data)
        
        return create_response(data=classes_list)
        
    except Exception as e:
        logging.error(f"Get live classes error: {str(e)}")
        return create_response(error="Failed to load live classes", status=500)

@app.route('/api/live-classes', methods=['POST'])
def create_live_class():
    try:
        data = request.get_json()
        if not data:
            return create_response(error="No data provided", status=400)
        
        required_fields = ['title', 'subject', 'schedule']
        for field in required_fields:
            if field not in data:
                return create_response(error=f"Missing required field: {field}", status=400)
        
        new_class = LiveClass(
            title=data['title'],
            subject=data['subject'],
            chapter=data.get('chapter', ''),
            teacher=data.get('teacher', ''),
            schedule=datetime.fromisoformat(data['schedule'].replace('Z', '+00:00')),
            duration_minutes=data.get('duration_minutes', 60),
            meeting_link=data.get('meeting_link', ''),
            status=data.get('status', 'scheduled')
        )
        
        db.session.add(new_class)
        db.session.commit()
        
        return create_response(
            data={'id': new_class.id},
            message="Live class created successfully"
        )
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Create live class error: {str(e)}")
        return create_response(error="Failed to create live class", status=500)

# Admin endpoints
@app.route('/api/admin/users', methods=['GET'])
def get_users():
    try:
        users = User.query.all()
        
        users_list = []
        for user in users:
            user_data = {
                'id': user.id,
                'email': user.email,
                'name': user.name,
                'class': user.user_class,
                'school': user.school,
                'role': user.role,
                'created_at': user.created_at.isoformat()
            }
            users_list.append(user_data)
        
        return create_response(data=users_list)
        
    except Exception as e:
        logging.error(f"Get users error: {str(e)}")
        return create_response(error="Failed to load users", status=500)

@app.route('/api/admin/stats', methods=['GET'])
def get_stats():
    try:
        # Total users
        total_users = User.query.count()
        
        # Active today
        today = datetime.utcnow().date()
        active_today = Progress.query.filter(
            db.func.date(Progress.last_accessed) == today
        ).distinct(Progress.user_id).count()
        
        # Total content
        total_content = Content.query.count()
        
        # Completion rate
        total_progress = Progress.query.count()
        completed_progress = Progress.query.filter_by(completed=True).count()
        completion_rate = round((completed_progress / total_progress * 100) if total_progress > 0 else 0, 2)
        
        stats = {
            'total_users': total_users,
            'active_today': active_today,
            'total_content': total_content,
            'completion_rate': completion_rate
        }
        
        return create_response(data=stats)
        
    except Exception as e:
        logging.error(f"Get stats error: {str(e)}")
        return create_response(error="Failed to load stats", status=500)

# Streak endpoint
@app.route('/api/streak/<int:user_id>', methods=['GET'])
def get_streak(user_id):
    try:
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
                'last_activity': datetime.utcnow().date().isoformat()
            }
        
        return create_response(data=streak_data)
        
    except Exception as e:
        logging.error(f"Get streak error: {str(e)}")
        return create_response(error="Failed to load streak", status=500)

# File upload endpoint
@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return create_response(error="No file uploaded", status=400)
        
        file = request.files['file']
        if file.filename == '':
            return create_response(error="No file selected", status=400)
        
        # Create uploads directory if it doesn't exist
        upload_dir = app.config['UPLOAD_FOLDER']
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)
        
        # Save file
        filename = f"{uuid.uuid4().hex}_{file.filename}"
        filepath = os.path.join(upload_dir, filename)
        file.save(filepath)
        
        return create_response(
            data={
                'filename': filename,
                'original_name': file.filename,
                'url': f'/uploads/{filename}',
                'size': os.path.getsize(filepath)
            },
            message="File uploaded successfully"
        )
        
    except Exception as e:
        logging.error(f"Upload error: {str(e)}")
        return create_response(error="Failed to upload file", status=500)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    try:
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    except Exception as e:
        logging.error(f"Serve file error: {str(e)}")
        return create_response(error="File not found", status=404)

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        # Test database connection
        db.session.execute(text('SELECT 1'))
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'database': 'connected'
        }), 200
    except Exception as e:
        logging.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

# Serve static files
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({
        'success': False,
        'error': 'Not found',
        'message': 'The requested resource was not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({
        'success': False,
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500

if __name__ == '__main__':
    # Create uploads directory
    if not os.path.exists('uploads'):
        os.makedirs('uploads')
    
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)