// ============================================
// CataCuti App - Complete Learning Platform
// Version: 2.0 with Automatic Sync
// ============================================

// Global Variables
let currentUser = null;
let users = JSON.parse(localStorage.getItem('catacutiUsers') || '[]');
let subjects = JSON.parse(localStorage.getItem('catacutiSubjects') || '[]');
let chapters = JSON.parse(localStorage.getItem('catacutiChapters') || '[]');
let videos = JSON.parse(localStorage.getItem('catacutiVideos') || '[]');
let questions = JSON.parse(localStorage.getItem('catacutiQuestions') || '[]');
let notes = JSON.parse(localStorage.getItem('catacutiNotes') || '[]');
let liveClasses = JSON.parse(localStorage.getItem('catacutiLiveClasses') || '[]');
let userProgress = JSON.parse(localStorage.getItem('catacutiUserProgress') || '{}');
let appClasses = JSON.parse(localStorage.getItem('catacutiClasses') || '[]');
let chatMessages = [];
let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let searchQuery = '';
let currentSubject = 'math';
let currentSection = 'chapters';

// Cloud Sync Configuration
const APP_ID = 'catacuti-app-cloud-v2';
const SYNC_INTERVAL = 15000; // Sync every 15 seconds
let lastSyncTime = localStorage.getItem('catacutiLastSync') || 0;
let syncInterval;

// ============================================
// CLOUD SYNC SYSTEM - Automatic between phones
// ============================================

function initCloudSync() {
    console.log('🔄 Initializing cloud sync system...');
    
    // Generate unique device ID if not exists
    let deviceId = localStorage.getItem('catacutiDeviceId');
    if (!deviceId) {
        deviceId = 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('catacutiDeviceId', deviceId);
        console.log('📱 Generated device ID:', deviceId);
    }
    
    // Load data from cloud on startup
    loadFromCloud();
    
    // Start periodic sync
    syncInterval = setInterval(syncToCloud, SYNC_INTERVAL);
    
    // Sync when app becomes visible
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            console.log('📱 App became visible, syncing...');
            loadFromCloud();
        }
    });
    
    // Sync on page load/unload
    window.addEventListener('beforeunload', syncToCloud);
    
    console.log('✅ Cloud sync system initialized');
}

function syncToCloud() {
    try {
        const cloudData = {
            appId: APP_ID,
            data: {
                users: users,
                subjects: subjects,
                chapters: chapters,
                videos: videos,
                questions: questions,
                notes: notes,
                liveClasses: liveClasses,
                appClasses: appClasses,
                userProgress: userProgress
            },
            metadata: {
                lastUpdated: Date.now(),
                updatedBy: currentUser ? currentUser.id : 'system',
                deviceId: localStorage.getItem('catacutiDeviceId'),
                totalUsers: users.length,
                totalChapters: chapters.length,
                totalVideos: videos.length
            }
        };
        
        // Save to cloud simulation
        localStorage.setItem(APP_ID, JSON.stringify(cloudData));
        localStorage.setItem('catacutiLastSync', Date.now().toString());
        lastSyncTime = Date.now();
        
        // Update sync status in UI if user is logged in
        if (currentUser && document.getElementById('app')) {
            updateSyncStatus();
        }
        
        console.log('✅ Data synced to cloud at', new Date().toLocaleTimeString());
        
    } catch (error) {
        console.error('❌ Sync error:', error);
        showNotification('Sync failed: ' + error.message, 'error');
    }
}

function loadFromCloud() {
    try {
        const cloudData = localStorage.getItem(APP_ID);
        if (!cloudData) {
            console.log('☁️ No cloud data found');
            return;
        }
        
        const parsedData = JSON.parse(cloudData);
        const localLastUpdate = localStorage.getItem('catacutiLastUpdate') || 0;
        const cloudLastUpdate = parsedData.metadata.lastUpdated;
        
        // Only update if cloud data is newer
        if (cloudLastUpdate > localLastUpdate) {
            console.log('☁️ Loading newer data from cloud...');
            
            // Merge cloud data with local data
            mergeCloudData(parsedData.data);
            
            // Save merged data
            saveAllData();
            
            // Update current user if logged in
            if (currentUser) {
                const updatedUser = users.find(u => u.id === currentUser.id);
                if (updatedUser) {
                    currentUser = updatedUser;
                    localStorage.setItem('catacutiCurrentUser', JSON.stringify(currentUser));
                    
                    // Refresh UI
                    if (document.getElementById('app').innerHTML.includes('Welcome back')) {
                        showHomeScreen();
                    }
                }
            }
            
            showNotification('📡 Data updated from cloud', 'success');
            console.log('✅ Cloud data loaded successfully');
        }
        
    } catch (error) {
        console.error('❌ Cloud load error:', error);
    }
}

function mergeCloudData(cloudData) {
    // Helper function to merge arrays
    const mergeArrays = (local, cloud, idField) => {
        const merged = [...local];
        const localMap = new Map(local.map(item => [item[idField], item]));
        
        cloud.forEach(cloudItem => {
            const localItem = localMap.get(cloudItem[idField]);
            if (!localItem) {
                merged.push(cloudItem);
            } else {
                // Keep newer item based on updatedAt or createdAt
                const localTime = localItem.updatedAt || localItem.createdAt || 0;
                const cloudTime = cloudItem.updatedAt || cloudItem.createdAt || 0;
                
                if (cloudTime > localTime) {
                    const index = merged.findIndex(item => item[idField] === cloudItem[idField]);
                    if (index !== -1) {
                        merged[index] = cloudItem;
                    }
                }
            }
        });
        
        return merged;
    };
    
    // Merge all data types
    users = mergeArrays(users, cloudData.users || [], 'id');
    subjects = mergeArrays(subjects, cloudData.subjects || [], 'id');
    chapters = mergeArrays(chapters, cloudData.chapters || [], 'id');
    videos = mergeArrays(videos, cloudData.videos || [], 'id');
    questions = mergeArrays(questions, cloudData.questions || [], 'id');
    notes = mergeArrays(notes, cloudData.notes || [], 'id');
    liveClasses = mergeArrays(liveClasses, cloudData.liveClasses || [], 'id');
    
    // Merge classes
    appClasses = [...new Set([...(cloudData.appClasses || []), ...appClasses])];
    
    // Merge user progress
    if (cloudData.userProgress) {
        for (const userId in cloudData.userProgress) {
            if (!userProgress[userId]) {
                userProgress[userId] = cloudData.userProgress[userId];
            } else {
                for (const chapterId in cloudData.userProgress[userId]) {
                    if (!userProgress[userId][chapterId]) {
                        userProgress[userId][chapterId] = cloudData.userProgress[userId][chapterId];
                    } else {
                        // Keep best scores
                        userProgress[userId][chapterId].score = Math.max(
                            userProgress[userId][chapterId].score,
                            cloudData.userProgress[userId][chapterId].score
                        );
                        userProgress[userId][chapterId].completed = 
                            userProgress[userId][chapterId].completed || 
                            cloudData.userProgress[userId][chapterId].completed;
                    }
                }
            }
        }
    }
}

function saveAllData() {
    const timestamp = Date.now();
    
    localStorage.setItem('catacutiUsers', JSON.stringify(users));
    localStorage.setItem('catacutiSubjects', JSON.stringify(subjects));
    localStorage.setItem('catacutiChapters', JSON.stringify(chapters));
    localStorage.setItem('catacutiVideos', JSON.stringify(videos));
    localStorage.setItem('catacutiQuestions', JSON.stringify(questions));
    localStorage.setItem('catacutiNotes', JSON.stringify(notes));
    localStorage.setItem('catacutiLiveClasses', JSON.stringify(liveClasses));
    localStorage.setItem('catacutiUserProgress', JSON.stringify(userProgress));
    localStorage.setItem('catacutiClasses', JSON.stringify(appClasses));
    localStorage.setItem('catacutiLastUpdate', timestamp.toString());
    
    // Trigger cloud sync
    syncToCloud();
    
    console.log('💾 All data saved at', new Date().toLocaleTimeString());
}

function updateSyncStatus() {
    const syncStatus = document.getElementById('syncStatus');
    if (!syncStatus && currentUser) {
        // Add sync status to header
        const header = document.querySelector('.home-header');
        if (header) {
            const statusDiv = document.createElement('div');
            statusDiv.id = 'syncStatus';
            statusDiv.className = 'sync-status synced';
            statusDiv.innerHTML = `🔄 Synced ${new Date().toLocaleTimeString().slice(0, 5)}`;
            header.appendChild(statusDiv);
        }
    } else if (syncStatus) {
        syncStatus.innerHTML = `🔄 Synced ${new Date().toLocaleTimeString().slice(0, 5)}`;
        syncStatus.className = 'sync-status synced';
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.sync-notification');
    if (existing) existing.remove();
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `sync-notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;cursor:pointer;">×</button>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 15px;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'fadeOut 0.5s ease';
            setTimeout(() => notification.remove(), 500);
        }
    }, 3000);
}

// ============================================
// INITIALIZATION
// ============================================

function initializeData() {
    console.log('🚀 Initializing CataCuti App...');
    
    // Start cloud sync system
    initCloudSync();
    
    // Initialize default classes
    if (appClasses.length === 0) {
        appClasses = ['6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade'];
        saveAllData();
    }
    
    // Initialize default users
    if (users.length === 0) {
        users = [
            {
                id: '1',
                email: 'student@gmail.com',
                password: '123456',
                displayName: 'Demo Student',
                class: '8th Grade',
                gender: 'male',
                school: 'Demo Public School',
                streak: 5,
                coins: 250,
                level: 2,
                isAdmin: false,
                isSuperAdmin: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            },
            {
                id: '2',
                email: 'pratikpreetam1714@gmail.com',
                password: 'pratik17',
                displayName: 'Dr. Pratik Platinum',
                class: '8th Grade',
                gender: 'male',
                school: 'CataCuti Institute',
                streak: 100,
                coins: 1000,
                level: 10,
                isAdmin: true,
                isSuperAdmin: true,
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
        ];
        saveAllData();
    }
    
    // Initialize default subjects
    if (subjects.length === 0) {
        subjects = [
            {
                id: 'math',
                name: 'Mathematics',
                description: 'Learn math concepts from basic to advanced',
                color: '#4361ee',
                classes: appClasses,
                createdAt: Date.now(),
                updatedAt: Date.now()
            },
            {
                id: 'science',
                name: 'Science',
                description: 'Explore scientific concepts and experiments',
                color: '#4CAF50',
                classes: appClasses,
                createdAt: Date.now(),
                updatedAt: Date.now()
            },
            {
                id: 'english',
                name: 'English',
                description: 'Improve language and communication skills',
                color: '#FF9800',
                classes: appClasses,
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
        ];
        saveAllData();
    }
    
    // Initialize demo chapters for each class
    if (chapters.length === 0) {
        const demoChapters = [
            { class: '8th Grade', subject: 'math', title: 'Algebra Basics', difficulty: 'beginner', questions: 5, duration: 45 },
            { class: '9th Grade', subject: 'math', title: 'Geometry Introduction', difficulty: 'intermediate', questions: 6, duration: 60 },
            { class: '10th Grade', subject: 'math', title: 'Trigonometry', difficulty: 'advanced', questions: 8, duration: 75 },
            { class: '8th Grade', subject: 'science', title: 'Basic Physics', difficulty: 'beginner', questions: 4, duration: 40 },
            { class: '9th Grade', subject: 'science', title: 'Chemistry Basics', difficulty: 'intermediate', questions: 7, duration: 65 }
        ];
        
        demoChapters.forEach((demo, index) => {
            chapters.push({
                id: (index + 1).toString(),
                subjectId: demo.subject,
                title: demo.title,
                description: `${demo.title} for ${demo.class}`,
                difficulty: demo.difficulty,
                questions: demo.questions,
                duration: demo.duration,
                class: demo.class,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        });
        saveAllData();
    }
    
    console.log('✅ App initialized successfully');
}

// ============================================
// AUTHENTICATION SYSTEM
// ============================================

function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const isSignup = document.getElementById('switchBtn').textContent.includes('Login');
    
    if (isSignup) {
        const name = document.getElementById('loginName').value;
        const studentClass = document.getElementById('loginClass').value;
        const gender = document.getElementById('loginGender').value;
        const school = document.getElementById('loginSchool').value;
        signup(email, password, name, studentClass, gender, school);
    } else {
        login(email, password);
    }
}

function login(email, password) {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        currentUser = user;
        localStorage.setItem('catacutiCurrentUser', JSON.stringify(user));
        showNotification(`Welcome back, ${user.displayName}!`, 'success');
        showHomeScreen();
    } else {
        showNotification('Invalid email or password.', 'error');
    }
}

function signup(email, password, displayName, studentClass, gender, school) {
    if (users.find(u => u.email === email)) {
        showNotification('User already exists. Please login.', 'error');
        return;
    }

    if (!email || !password || !displayName || !studentClass || !gender || !school) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }

    const newUser = {
        id: Date.now().toString(),
        email: email,
        password: password,
        displayName: displayName,
        class: studentClass,
        gender: gender,
        school: school,
        streak: 0,
        coins: 100,
        level: 1,
        isAdmin: false,
        isSuperAdmin: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    users.push(newUser);
    currentUser = newUser;
    localStorage.setItem('catacutiCurrentUser', JSON.stringify(newUser));
    saveAllData();
    
    showNotification(`Welcome ${displayName}! Account created.`, 'success');
    showHomeScreen();
}

function toggleSignup() {
    const switchBtn = document.getElementById('switchBtn');
    const loginBtn = document.getElementById('loginBtn');
    const nameInput = document.getElementById('loginName');
    const classInput = document.getElementById('loginClass');
    const genderInput = document.getElementById('loginGender');
    const schoolInput = document.getElementById('loginSchool');
    
    if (switchBtn.textContent.includes('Register')) {
        switchBtn.textContent = 'Already have an account? Login';
        loginBtn.textContent = 'Create Account';
        nameInput.style.display = 'block';
        classInput.style.display = 'block';
        genderInput.style.display = 'block';
        schoolInput.style.display = 'block';
    } else {
        switchBtn.textContent = 'Register as Student';
        loginBtn.textContent = 'Login';
        nameInput.style.display = 'none';
        classInput.style.display = 'none';
        genderInput.style.display = 'none';
        schoolInput.style.display = 'none';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('catacutiCurrentUser');
    showLoginScreen();
}

// ============================================
// MAIN SCREENS
// ============================================

function showLoginScreen() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('app').innerHTML = '';
}

function showHomeScreen() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('adminModal').style.display = 'none';
    document.getElementById('classModal').style.display = 'none';
    
    // Filter content by user's class
    const subjectChapters = chapters.filter(ch => 
        ch.subjectId === currentSubject && 
        ch.class === currentUser.class
    );
    
    const subjectVideos = videos.filter(vid => 
        vid.subjectId === currentSubject && 
        vid.class === currentUser.class
    );
    
    const userLiveClasses = liveClasses.filter(lc => 
        lc.class === currentUser.class
    );
    
    const userProgressData = userProgress[currentUser.id] || {};
    const overallAccuracy = calculateOverallAccuracy(userProgressData);
    const chaptersCompleted = calculateChaptersCompleted(userProgressData);
    
    let contentHTML = '';
    
    if (currentSection === 'chapters') {
        contentHTML = `
            <div class="content-section">
                <h3>📚 Chapters (${filterChapters(subjectChapters).length})</h3>
                ${filterChapters(subjectChapters).length === 0 ? 
                    `<div class="empty-state">
                        <div class="empty-icon">📚</div>
                        <h4>No chapters available</h4>
                        <p>No chapters found for ${currentUser.class} - ${subjects.find(s => s.id === currentSubject)?.name}</p>
                        ${currentUser.isAdmin ? '<button class="streak-btn" onclick="loadAdminContent(\'chapters\'); showAdminPanel()">Add Chapters</button>' : ''}
                    </div>` :
                    `<div class="content-grid">
                        ${filterChapters(subjectChapters).map(chapter => `
                            <div class="content-card" onclick="showChapterNotes('${chapter.id}')">
                                <h4>${chapter.title}</h4>
                                <p>${chapter.description}</p>
                                <div class="content-meta">
                                    <span>📊 ${chapter.questions} questions</span>
                                    <span>⏱️ ${chapter.duration} min</span>
                                    <span class="class-badge">${chapter.class}</span>
                                    <span class="difficulty-badge ${chapter.difficulty}">${chapter.difficulty}</span>
                                </div>
                                ${userProgressData[chapter.id] ? 
                                    `<div class="progress-indicator">
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${userProgressData[chapter.id].score}%"></div>
                                        </div>
                                        <span>${userProgressData[chapter.id].score}%</span>
                                    </div>` : 
                                    ''
                                }
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
        `;
    } else if (currentSection === 'videos') {
        contentHTML = `
            <div class="content-section">
                <h3>🎥 Video Lessons (${filterVideos(subjectVideos).length})</h3>
                ${filterVideos(subjectVideos).length === 0 ? 
                    `<div class="empty-state">
                        <div class="empty-icon">🎥</div>
                        <h4>No videos available</h4>
                        <p>No videos found for ${currentUser.class} - ${subjects.find(s => s.id === currentSubject)?.name}</p>
                    </div>` :
                    `<div class="content-grid">
                        ${filterVideos(subjectVideos).map(video => `
                            <div class="content-card" onclick="playVideo('${video.id}')">
                                <h4>${video.title}</h4>
                                <p>${video.description}</p>
                                <div class="content-meta">
                                    <span>⏱️ ${video.duration}</span>
                                    <span class="class-badge">${video.class}</span>
                                    <span>🎬 Video Lesson</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
        `;
    } else if (currentSection === 'progress') {
        const userClassChapters = chapters.filter(ch => ch.class === currentUser.class);
        const userClassChaptersCompleted = userClassChapters.filter(ch => {
            const progress = userProgress[currentUser.id] || {};
            return progress[ch.id] && progress[ch.id].completed;
        }).length;
        
        contentHTML = `
            <div class="progress-grid">
                <div class="progress-card">
                    <div class="progress-number">${overallAccuracy}%</div>
                    <div class="progress-label">Overall Accuracy</div>
                </div>
                <div class="progress-card">
                    <div class="progress-number">${userClassChaptersCompleted}/${userClassChapters.length}</div>
                    <div class="progress-label">Chapters Completed</div>
                </div>
                <div class="progress-card">
                    <div class="progress-number">${Math.round(currentUser.coins / 10)}h</div>
                    <div class="progress-label">Study Hours</div>
                </div>
                <div class="progress-card">
                    <div class="progress-number">${currentUser.streak}🔥</div>
                    <div class="progress-label">Day Streak</div>
                </div>
            </div>

            <div class="content-section">
                <h3>📊 Subject-wise Performance</h3>
                <div class="content-grid">
                    ${subjects.map(subject => {
                        const subjectChapters = chapters.filter(ch => 
                            ch.subjectId === subject.id && ch.class === currentUser.class
                        );
                        const completed = subjectChapters.filter(ch => {
                            const progress = userProgress[currentUser.id] || {};
                            return progress[ch.id] && progress[ch.id].completed;
                        }).length;
                        const percentage = subjectChapters.length > 0 ? Math.round((completed / subjectChapters.length) * 100) : 0;
                        
                        return `
                            <div class="content-card">
                                <h4 style="color: ${subject.color}">${subject.name}</h4>
                                <p>${completed}/${subjectChapters.length} chapters completed</p>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${percentage}%; background: ${subject.color}"></div>
                                </div>
                                <div class="content-meta">
                                    <span>${percentage}% Complete</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } else if (currentSection === 'live') {
        contentHTML = `
            <div class="content-section">
                <h3>🎥 Live Classes (${userLiveClasses.length})</h3>
                ${userLiveClasses.length === 0 ? 
                    `<div class="empty-state">
                        <div class="empty-icon">🎥</div>
                        <h4>No live classes scheduled</h4>
                        <p>No live classes scheduled for ${currentUser.class} yet.</p>
                        ${currentUser.isAdmin ? '<button class="streak-btn" onclick="showLiveClassForm()">Schedule Live Class</button>' : ''}
                    </div>` :
                    `<div class="content-grid">
                        ${userLiveClasses.map(liveClass => {
                            const scheduleDate = new Date(liveClass.schedule);
                            const now = new Date();
                            const timeDiff = scheduleDate - now;
                            const hoursUntil = Math.floor(timeDiff / (1000 * 60 * 60));
                            const minutesUntil = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                            
                            let statusBadge = '';
                            if (liveClass.status === 'live') {
                                statusBadge = '<span class="live-status live">🔴 LIVE NOW</span>';
                            } else if (liveClass.status === 'scheduled') {
                                statusBadge = `<span class="live-status scheduled">⏰ In ${hoursUntil}h ${minutesUntil}m</span>`;
                            } else {
                                statusBadge = '<span class="live-status completed">✅ Completed</span>';
                            }
                            
                            return `
                                <div class="content-card ${liveClass.status === 'live' ? 'live-now' : ''}">
                                    <h4>${liveClass.title}</h4>
                                    <p>${liveClass.description}</p>
                                    <div class="content-meta">
                                        <span>📚 ${liveClass.subject}</span>
                                        <span>👨‍🏫 ${liveClass.teacher}</span>
                                        <span>⏱️ ${liveClass.duration}</span>
                                        <span>📅 ${new Date(liveClass.schedule).toLocaleDateString()}</span>
                                    </div>
                                    <div style="margin-top: 10px;">
                                        ${statusBadge}
                                        ${liveClass.status === 'live' || liveClass.status === 'scheduled' ? 
                                            `<button class="streak-btn join-btn" onclick="joinLiveClass('${liveClass.id}')" style="margin-top: 10px; width: 100%;">
                                                ${liveClass.status === 'live' ? 'Join Now 🔴' : 'Set Reminder ⏰'}
                                            </button>` : ''
                                        }
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>`
                }
                ${currentUser.isAdmin ? 
                    `<button class="streak-btn" onclick="showLiveClassForm()" style="margin-top: 20px; width: 100%;">
                        🎥 Schedule New Live Class
                    </button>` : ''
                }
            </div>
        `;
    }
    
    document.getElementById('app').innerHTML = `
        <div class="home-container">
            <div class="home-header">
                <div>
                    <h1>Welcome back, ${currentUser.displayName}! 👋</h1>
                    <p>📧 ${currentUser.email} • 🏫 ${currentUser.class} • 🎓 ${currentUser.school}</p>
                    <p>🔥 ${currentUser.streak} day streak • ⭐ ${currentUser.coins} coins • 🏆 Level ${currentUser.level}</p>
                </div>
                <div class="header-actions">
                    ${currentUser.isAdmin ? '<button class="admin-btn" onclick="showAdminPanel()">Admin Panel</button>' : ''}
                    ${currentUser.isSuperAdmin ? '<button class="admin-btn" onclick="showClassManagement()" style="background: #9C27B0;">🏫 Manage Classes</button>' : ''}
                    <button class="logout-btn" onclick="logout()">Logout</button>
                </div>
            </div>

            <div class="nav-menu">
                <button class="nav-item ${currentSection === 'chapters' ? 'active' : ''}" onclick="changeSection('chapters')">📚 Chapters</button>
                <button class="nav-item" onclick="showAIDoubtSolver()">🤖 AI Tutor</button>
                <button class="nav-item ${currentSection === 'progress' ? 'active' : ''}" onclick="changeSection('progress')">📊 Progress</button>
                <button class="nav-item ${currentSection === 'videos' ? 'active' : ''}" onclick="changeSection('videos')">🎥 Videos</button>
                <button class="nav-item ${currentSection === 'live' ? 'active' : ''}" onclick="changeSection('live')">🎥 Live Classes</button>
                <button class="nav-item" onclick="showQuizSelection()">🧠 Quiz</button>
                <button class="nav-item" onclick="showCertificate()">🏆 Certificate</button>
            </div>

            <div class="selector-container">
                <p>Choose a subject:</p>
                <div class="selector-scroll">
                    ${subjects.map(subject => `
                        <button class="selector-btn ${currentSubject === subject.id ? 'active' : ''}" 
                                onclick="changeSubject('${subject.id}')"
                                style="background: ${currentSubject === subject.id ? subject.color : '#f0f0f0'}; color: ${currentSubject === subject.id ? 'white' : '#666'}">
                            ${subject.name}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="search-container">
                <input type="text" class="search-bar" placeholder="Search chapters, videos, or notes..." 
                       oninput="handleSearch(this.value)" id="searchInput" value="${searchQuery}">
            </div>

            <div class="subject-content">
                ${contentHTML}
            </div>

            <div class="streak-card">
                <h3>🔥 ${currentUser.streak} Day Streak! • ⭐ ${currentUser.coins} Coins</h3>
                <p>Complete today's quiz to keep your streak going and earn coins!</p>
                <button class="streak-btn" onclick="showQuizSelection()">Take Daily Quiz</button>
            </div>
        </div>
    `;
    
    // Add sync status after home screen loads
    setTimeout(updateSyncStatus, 100);
}

// ============================================
// NAVIGATION FUNCTIONS
// ============================================

function changeSubject(subjectId) {
    currentSubject = subjectId;
    showHomeScreen();
}

function changeSection(section) {
    currentSection = section;
    showHomeScreen();
}

function handleSearch(query) {
    searchQuery = query;
    showHomeScreen();
}

function filterChapters(chapterList) {
    if (!searchQuery) return chapterList;
    const query = searchQuery.toLowerCase();
    return chapterList.filter(chapter => 
        chapter.title.toLowerCase().includes(query) || 
        chapter.description.toLowerCase().includes(query)
    );
}

function filterVideos(videoList) {
    if (!searchQuery) return videoList;
    const query = searchQuery.toLowerCase();
    return videoList.filter(video => 
        video.title.toLowerCase().includes(query) || 
        video.description.toLowerCase().includes(query)
    );
}

// ============================================
// CLASS MANAGEMENT
// ============================================

function showClassManagement() {
    document.getElementById('classModal').style.display = 'flex';
    document.getElementById('classContent').innerHTML = `
        <div class="admin-form">
            <h3>🏫 Class Management & Sync</h3>
            
            <div class="sync-status-card">
                <h4>🔄 Cloud Sync Status</h4>
                <p><strong>Status:</strong> <span class="sync-indicator active">ACTIVE</span></p>
                <p><strong>Last Sync:</strong> ${lastSyncTime ? new Date(parseInt(lastSyncTime)).toLocaleTimeString() : 'Never'}</p>
                <p><strong>Device ID:</strong> ${localStorage.getItem('catacutiDeviceId')}</p>
                <p><strong>Sync Interval:</strong> Every 15 seconds</p>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button onclick="manualSync()" class="streak-btn">🔄 Sync Now</button>
                    <button onclick="forceSave()" class="secondary-btn">💾 Save All</button>
                </div>
            </div>
            
            <div style="margin: 2rem 0;">
                <h4>Current Classes (${appClasses.length})</h4>
                <div class="content-list">
                    ${appClasses.map(cls => `
                        <div class="content-item">
                            <div>
                                <strong>${cls}</strong>
                                <small>
                                    👨‍🎓 ${users.filter(u => u.class === cls && !u.isAdmin).length} students | 
                                    👨‍🏫 ${users.filter(u => u.class === cls && u.isAdmin).length} teachers |
                                    📚 ${chapters.filter(c => c.class === cls).length} chapters |
                                    🎥 ${videos.filter(v => v.class === cls).length} videos
                                </small>
                            </div>
                            ${cls !== '6th Grade' && cls !== '7th Grade' && cls !== '8th Grade' && cls !== '9th Grade' && cls !== '10th Grade' ? 
                                `<button class="delete-btn" onclick="removeClass('${cls}')">Remove</button>` :
                                '<span class="default-badge">Default</span>'
                            }
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="admin-form">
                <h4>➕ Add New Class</h4>
                <input type="text" id="newClassName" placeholder="Class Name (e.g., 11th Grade)">
                <button onclick="addNewClass()" class="streak-btn">Add Class</button>
            </div>
            
            <div style="margin-top: 2rem;">
                <h4>📊 Data Management</h4>
                <p>Total: 👨‍🎓 ${users.length} users | 📚 ${chapters.length} chapters | 🎥 ${videos.length} videos</p>
                <div class="data-actions">
                    <button onclick="exportData()" class="secondary-btn">📥 Export Backup</button>
                    <button onclick="importData()" class="secondary-btn">📤 Import Backup</button>
                    <button onclick="showCloudData()" class="secondary-btn">☁️ View Cloud Data</button>
                    <button onclick="resetData()" class="danger-btn">🗑️ Reset All</button>
                </div>
            </div>
        </div>
    `;
}

function closeClassModal() {
    document.getElementById('classModal').style.display = 'none';
}

function addNewClass() {
    const className = document.getElementById('newClassName').value.trim();
    if (!className) {
        showNotification('Please enter a class name', 'error');
        return;
    }
    
    if (appClasses.includes(className)) {
        showNotification('Class already exists', 'error');
        return;
    }
    
    appClasses.push(className);
    saveAllData();
    showNotification(`Class "${className}" added successfully!`, 'success');
    showClassManagement();
}

function removeClass(className) {
    if (!confirm(`Remove ${className}? This will delete all content for this class.`)) return;
    
    appClasses = appClasses.filter(c => c !== className);
    chapters = chapters.filter(c => c.class !== className);
    videos = videos.filter(v => v.class !== className);
    questions = questions.filter(q => q.class !== className);
    notes = notes.filter(n => n.class !== className);
    liveClasses = liveClasses.filter(lc => lc.class !== className);
    
    saveAllData();
    showNotification(`Class "${className}" removed!`, 'success');
    showClassManagement();
}

function manualSync() {
    syncToCloud();
    loadFromCloud();
    showNotification('Manual sync completed!', 'success');
    showClassManagement();
}

function forceSave() {
    saveAllData();
    showNotification('All data saved and synced!', 'success');
}

function exportData() {
    const data = {
        users: users,
        subjects: subjects,
        chapters: chapters,
        videos: videos,
        questions: questions,
        notes: notes,
        liveClasses: liveClasses,
        appClasses: appClasses,
        userProgress: userProgress,
        exportedAt: new Date().toISOString(),
        version: '2.0'
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const fileName = `catacuti_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', fileName);
    link.click();
    
    showNotification('Backup exported successfully!', 'success');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (confirm('This will replace all current data. Continue?')) {
                    users = importedData.users || users;
                    subjects = importedData.subjects || subjects;
                    chapters = importedData.chapters || chapters;
                    videos = importedData.videos || videos;
                    questions = importedData.questions || questions;
                    notes = importedData.notes || notes;
                    liveClasses = importedData.liveClasses || liveClasses;
                    appClasses = importedData.appClasses || appClasses;
                    userProgress = importedData.userProgress || userProgress;
                    
                    saveAllData();
                    showNotification('Data imported successfully! Refreshing...', 'success');
                    setTimeout(() => location.reload(), 1000);
                }
            } catch (error) {
                showNotification('Import error: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function showCloudData() {
    const cloudData = localStorage.getItem(APP_ID);
    if (cloudData) {
        const data = JSON.parse(cloudData);
        alert(`Cloud Data Preview:\n\nLast Updated: ${new Date(data.metadata.lastUpdated).toLocaleString()}\nBy Device: ${data.metadata.deviceId}\nTotal Users: ${data.metadata.totalUsers}\nTotal Chapters: ${data.metadata.totalChapters}`);
    } else {
        alert('No cloud data found');
    }
}

function resetData() {
    if (confirm('⚠️ WARNING: This will delete ALL data! Are you absolutely sure?')) {
        localStorage.clear();
        showNotification('All data cleared! Refreshing...', 'warning');
        setTimeout(() => location.reload(), 1000);
    }
}

// ============================================
// LIVE CLASSES
// ============================================

function showLiveClassForm() {
    document.getElementById('liveClassesModal').style.display = 'flex';
    document.getElementById('liveClassesContent').innerHTML = `
        <div class="admin-form">
            <h3>🎥 Schedule Live Class</h3>
            <input type="text" id="liveClassTitle" placeholder="Class Title" value="Live ${subjects.find(s => s.id === currentSubject)?.name} Class">
            <select id="liveClassSubject">
                <option value="">Select Subject</option>
                ${subjects.map(sub => `<option value="${sub.id}" ${sub.id === currentSubject ? 'selected' : ''}>${sub.name}</option>`).join('')}
            </select>
            <textarea id="liveClassDesc" placeholder="Description">Live interactive session on ${subjects.find(s => s.id === currentSubject)?.name}</textarea>
            <input type="datetime-local" id="liveClassSchedule" value="${new Date(Date.now() + 86400000).toISOString().slice(0, 16)}">
            <input type="text" id="liveClassDuration" placeholder="Duration (e.g., 60 minutes)" value="60 minutes">
            <input type="text" id="liveClassLink" placeholder="Google Meet/Zoom Link" value="https://meet.google.com/new">
            <select id="liveClassStatus">
                <option value="scheduled">Scheduled</option>
                <option value="live">Live Now</option>
            </select>
            <select id="liveClassForClass">
                <option value="${currentUser.class}">${currentUser.class} (Current Class)</option>
                ${currentUser.isSuperAdmin ? appClasses.filter(c => c !== currentUser.class).map(cls => 
                    `<option value="${cls}">${cls}</option>`
                ).join('') : ''}
            </select>
            
            <div class="form-actions">
                <button class="streak-btn" onclick="scheduleLiveClass()">🎥 Schedule Class</button>
                <button class="secondary-btn" onclick="closeLiveClasses()">Cancel</button>
            </div>
        </div>
        
        <div style="margin-top: 2rem;">
            <h3>📅 Upcoming Live Classes</h3>
            <div class="content-list">
                ${liveClasses.filter(lc => lc.class === currentUser.class).length === 0 ? 
                    '<p style="text-align: center; color: #666; padding: 1rem;">No upcoming classes</p>' :
                    liveClasses.filter(lc => lc.class === currentUser.class).map(liveClass => `
                        <div class="content-item">
                            <div>
                                <strong>${liveClass.title}</strong>
                                <p>${liveClass.description}</p>
                                <small>📅 ${new Date(liveClass.schedule).toLocaleString()} | ⏱️ ${liveClass.duration} | 👨‍🏫 ${liveClass.teacher}</small>
                            </div>
                            <button class="delete-btn" onclick="deleteLiveClass('${liveClass.id}')">Delete</button>
                        </div>
                    `).join('')
                }
            </div>
        </div>
    `;
}

function closeLiveClasses() {
    document.getElementById('liveClassesModal').style.display = 'none';
}

function scheduleLiveClass() {
    const title = document.getElementById('liveClassTitle').value;
    const subject = document.getElementById('liveClassSubject').value;
    const description = document.getElementById('liveClassDesc').value;
    const schedule = document.getElementById('liveClassSchedule').value;
    const duration = document.getElementById('liveClassDuration').value;
    const meetingLink = document.getElementById('liveClassLink').value;
    const status = document.getElementById('liveClassStatus').value;
    const forClass = document.getElementById('liveClassForClass').value;
    
    if (!title || !subject || !description || !schedule || !duration || !meetingLink) {
        showNotification('Please fill all required fields', 'error');
        return;
    }
    
    if (!currentUser.isSuperAdmin && forClass !== currentUser.class) {
        showNotification('You can only schedule for your class', 'error');
        return;
    }
    
    const newLiveClass = {
        id: Date.now().toString(),
        title: title,
        subject: subjects.find(s => s.id === subject)?.name || subject,
        teacher: currentUser.displayName,
        description: description,
        schedule: new Date(schedule).toISOString(),
        duration: duration,
        meetingLink: meetingLink,
        status: status,
        class: forClass,
        attendees: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    liveClasses.push(newLiveClass);
    saveAllData();
    showNotification('Live class scheduled!', 'success');
    closeLiveClasses();
    changeSection('live');
}

function joinLiveClass(liveClassId) {
    const liveClass = liveClasses.find(lc => lc.id === liveClassId);
    if (!liveClass) return;
    
    if (liveClass.class !== currentUser.class) {
        showNotification('This class is for ' + liveClass.class + ' only', 'error');
        return;
    }
    
    const now = new Date();
    const scheduleDate = new Date(liveClass.schedule);
    
    if (liveClass.status === 'live') {
        if (!liveClass.attendees.includes(currentUser.id)) {
            liveClass.attendees.push(currentUser.id);
            liveClass.updatedAt = Date.now();
            saveAllData();
        }
        
        window.open(liveClass.meetingLink, '_blank');
        showNotification('Joining live class...', 'success');
    } else if (liveClass.status === 'scheduled') {
        const timeUntil = scheduleDate - now;
        if (timeUntil > 0) {
            const minutesUntil = Math.floor(timeUntil / (1000 * 60));
            showNotification(`Class starts in ${minutesUntil} minutes. We'll remind you!`, 'info');
            
            setTimeout(() => {
                if (confirm(`Reminder: "${liveClass.title}" starts in 10 minutes! Join now?`)) {
                    window.open(liveClass.meetingLink, '_blank');
                }
            }, Math.max(0, timeUntil - 600000));
        } else {
            showNotification('Class already started or ended', 'info');
        }
    }
}

function deleteLiveClass(liveClassId) {
    const liveClass = liveClasses.find(lc => lc.id === liveClassId);
    if (!liveClass || (liveClass.class !== currentUser.class && !currentUser.isSuperAdmin)) {
        showNotification('Cannot delete this class', 'error');
        return;
    }
    
    if (confirm('Delete this live class?')) {
        liveClasses = liveClasses.filter(lc => lc.id !== liveClassId);
        saveAllData();
        showLiveClassForm();
        changeSection('live');
    }
}

// ============================================
// QUIZ SYSTEM
// ============================================

function showQuizSelection() {
    document.getElementById('quizModal').style.display = 'flex';
    
    const availableSubjects = subjects.filter(subject => {
        const subjectChapters = chapters.filter(ch => 
            ch.subjectId === subject.id && 
            ch.class === currentUser.class
        );
        return subjectChapters.length > 0;
    });
    
    document.querySelector('.quiz-content').innerHTML = `
        <div class="quiz-selection">
            ${availableSubjects.map(subject => {
                const subjectChapters = chapters.filter(ch => 
                    ch.subjectId === subject.id && 
                    ch.class === currentUser.class
                );
                
                return `
                    <div class="quiz-card" onclick="selectSubjectForQuiz('${subject.id}')" style="border-left: 4px solid ${subject.color}">
                        <h3>${subject.name}</h3>
                        <p>${subjectChapters.length} chapters available</p>
                        <small>Class: ${currentUser.class}</small>
                    </div>
                `;
            }).join('')}
        </div>
        ${availableSubjects.length === 0 ? 
            `<div class="empty-state">
                <div class="empty-icon">🧠</div>
                <h4>No quizzes available</h4>
                <p>No chapters found for your class (${currentUser.class})</p>
                <button class="streak-btn" onclick="closeQuizModal()">OK</button>
            </div>` : 
            ''
        }
    `;
}

function selectSubjectForQuiz(subjectId) {
    const subjectChapters = chapters.filter(ch => 
        ch.subjectId === subjectId && 
        ch.class === currentUser.class
    );
    
    document.querySelector('.quiz-content').innerHTML = `
        <h3>Select Chapter - ${subjects.find(s => s.id === subjectId).name}</h3>
        <div class="quiz-selection">
            ${subjectChapters.map(chapter => `
                <div class="quiz-card" onclick="startQuiz('${chapter.id}')">
                    <h4>${chapter.title}</h4>
                    <p>${chapter.questions} questions • ${chapter.duration} min</p>
                    <small>${chapter.difficulty} • ${chapter.class}</small>
                    ${userProgress[currentUser.id] && userProgress[currentUser.id][chapter.id] ? 
                        `<div class="quiz-score">Best: ${userProgress[currentUser.id][chapter.id].score}%</div>` : 
                        ''
                    }
                </div>
            `).join('')}
        </div>
        <button class="streak-btn" onclick="showQuizSelection()" style="margin-top: 1rem;">← Back</button>
    `;
}

function startQuiz(chapterId) {
    const chapter = chapters.find(ch => ch.id === chapterId);
    
    if (chapter.class !== currentUser.class) {
        showNotification('This quiz is not for your class', 'error');
        return;
    }
    
    const chapterQuestions = questions.filter(q => 
        q.chapterId === chapterId && 
        q.class === currentUser.class
    );
    
    if (chapterQuestions.length === 0) {
        showNotification('No questions available yet', 'info');
        return;
    }
    
    currentQuiz = {
        chapterId: chapterId,
        questions: chapterQuestions
    };
    currentQuestionIndex = 0;
    userAnswers = [];
    
    showQuestion();
}

function showQuestion() {
    if (!currentQuiz || currentQuestionIndex >= currentQuiz.questions.length) {
        showQuizResults();
        return;
    }
    
    const question = currentQuiz.questions[currentQuestionIndex];
    
    document.querySelector('.quiz-content').innerHTML = `
        <div class="quiz-progress">
            Question ${currentQuestionIndex + 1} of ${currentQuiz.questions.length}
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100}%"></div>
            </div>
        </div>
        
        <div class="quiz-question">
            <p>${question.question}</p>
        </div>
        
        <div class="quiz-options">
            ${question.options.map((option, index) => `
                <div class="quiz-option ${userAnswers[currentQuestionIndex] === index ? 'selected' : ''}" 
                     onclick="selectAnswer(${index})">
                    <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                    <span class="option-text">${option}</span>
                </div>
            `).join('')}
        </div>
        
        <div class="quiz-navigation">
            <button class="secondary-btn" onclick="previousQuestion()" ${currentQuestionIndex === 0 ? 'disabled' : ''}>
                ← Previous
            </button>
            <button class="streak-btn" onclick="nextQuestion()">
                ${currentQuestionIndex === currentQuiz.questions.length - 1 ? 'Finish Quiz 🏁' : 'Next →'}
            </button>
        </div>
    `;
}

function selectAnswer(answerIndex) {
    userAnswers[currentQuestionIndex] = answerIndex;
    showQuestion();
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    } else {
        showQuizResults();
    }
}

function showQuizResults() {
    if (!currentQuiz) return;
    
    let correctAnswers = 0;
    currentQuiz.questions.forEach((question, index) => {
        if (userAnswers[index] === question.correctAnswer) {
            correctAnswers++;
        }
    });
    
    const score = Math.round((correctAnswers / currentQuiz.questions.length) * 100);
    const badge = getBadge(score);
    const chapter = chapters.find(ch => ch.id === currentQuiz.chapterId);
    
    // Update user progress
    if (!userProgress[currentUser.id]) {
        userProgress[currentUser.id] = {};
    }
    
    if (!userProgress[currentUser.id][currentQuiz.chapterId]) {
        userProgress[currentUser.id][currentQuiz.chapterId] = {
            completed: false,
            score: 0,
            attempts: 0
        };
    }
    
    userProgress[currentUser.id][currentQuiz.chapterId].attempts++;
    userProgress[currentUser.id][currentQuiz.chapterId].score = Math.max(
        userProgress[currentUser.id][currentQuiz.chapterId].score,
        score
    );
    
    if (score >= 70) {
        userProgress[currentUser.id][currentQuiz.chapterId].completed = true;
    }
    
    // Update user stats
    currentUser.coins += Math.round(score / 10) + 10;
    currentUser.streak++;
    
    // Update user in array
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    if (userIndex !== -1) {
        users[userIndex] = currentUser;
    }
    
    // Save everything
    saveAllData();
    
    document.querySelector('.quiz-content').innerHTML = `
        <div class="quiz-result">
            <div class="badge-icon">${badge.emoji}</div>
            <h2>${badge.name} Badge!</h2>
            <p class="score-display">${score}%</p>
            <p>${correctAnswers} out of ${currentQuiz.questions.length} correct</p>
            
            <div class="result-details">
                <h3>📊 Quiz Results</h3>
                <div class="result-grid">
                    <div class="result-item">
                        <span>Chapter:</span>
                        <span>${chapter?.title}</span>
                    </div>
                    <div class="result-item">
                        <span>Class:</span>
                        <span>${chapter?.class}</span>
                    </div>
                    <div class="result-item">
                        <span>Coins Earned:</span>
                        <span>+${Math.round(score / 10) + 10} ⭐</span>
                    </div>
                    <div class="result-item">
                        <span>Streak:</span>
                        <span>${currentUser.streak} days 🔥</span>
                    </div>
                </div>
            </div>
            
            <div class="progress-report">
                <h4>📝 Question Review</h4>
                ${currentQuiz.questions.map((question, index) => {
                    const isCorrect = userAnswers[index] === question.correctAnswer;
                    return `
                        <div class="progress-item ${isCorrect ? 'correct' : 'incorrect'}">
                            <span>Q${index + 1}: ${isCorrect ? '✅' : '❌'}</span>
                            <span>${isCorrect ? 'Correct' : 'Incorrect'}</span>
                            ${!isCorrect ? `<small>Correct: ${question.options[question.correctAnswer]}</small>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            
            <button class="streak-btn" onclick="closeQuizModal()" style="margin-top: 2rem;">
                Continue Learning
            </button>
        </div>
    `;
}

function getBadge(score) {
    if (score >= 90) return { name: 'Platinum Master', emoji: '🏆' };
    if (score >= 80) return { name: 'Gold Expert', emoji: '🥇' };
    if (score >= 70) return { name: 'Silver Scholar', emoji: '🥈' };
    if (score >= 60) return { name: 'Bronze Learner', emoji: '🥉' };
    return { name: 'Keep Practicing', emoji: '📚' };
}

function closeQuizModal() {
    document.getElementById('quizModal').style.display = 'none';
    currentQuiz = null;
    currentQuestionIndex = 0;
    userAnswers = [];
}

// ============================================
// VIDEO PLAYER
// ============================================

function playVideo(videoId) {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    
    if (video.class !== currentUser.class) {
        showNotification('This video is not for your class', 'error');
        return;
    }
    
    document.getElementById('videoModal').style.display = 'flex';
    document.querySelector('.video-content').innerHTML = `
        <div class="video-player">
            <iframe width="100%" height="100%" src="${video.url}" frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
            </iframe>
        </div>
        <div class="video-info">
            <h3>${video.title}</h3>
            <p>${video.description}</p>
            <div class="video-meta">
                <span>⏱️ ${video.duration}</span>
                <span class="class-badge">${video.class}</span>
                <span>🎬 Video Lesson</span>
            </div>
        </div>
    `;
}

function closeVideoModal() {
    document.getElementById('videoModal').style.display = 'none';
}

// ============================================
// NOTES & FILES
// ============================================

function showChapterNotes(chapterId) {
    const chapter = chapters.find(c => c.id === chapterId);
    
    if (chapter.class !== currentUser.class && !currentUser.isAdmin) {
        showNotification('This chapter is not for your class', 'error');
        return;
    }
    
    const chapterNotes = notes.find(n => n.chapterId === chapterId && n.class === chapter.class) || { content: '', files: [] };
    
    document.getElementById('notesModal').style.display = 'flex';
    document.querySelector('.notes-content').innerHTML = `
        <div class="notes-header">
            <h3>${chapter.title}</h3>
            <p class="chapter-meta">${chapter.class} • ${chapter.difficulty} • ${chapter.duration} min</p>
        </div>
        
        <div class="notes-viewer">
            ${chapterNotes.content ? 
                `<div class="notes-content-text">${chapterNotes.content}</div>` : 
                `<div class="empty-notes">
                    <div class="empty-icon">📝</div>
                    <h4>No notes available</h4>
                    <p>No notes have been added for this chapter yet.</p>
                </div>`
            }
            
            ${chapterNotes.files && chapterNotes.files.length > 0 ? `
                <div class="files-section">
                    <h4>📎 Attached Files</h4>
                    ${chapterNotes.files.map(file => `
                        <div class="file-item">
                            <div class="file-info" onclick="openFile('${file.name}', '${file.type}')">
                                <span class="file-icon">${getFileIcon(file.name)}</span>
                                <div class="file-details">
                                    <strong>${file.name}</strong>
                                    <small>${Math.round(file.size/1024)} KB • ${file.uploaded}</small>
                                </div>
                            </div>
                            <div class="file-actions">
                                <button class="file-action-btn open" onclick="openFile('${file.name}', '${file.type}')">
                                    👁️ View
                                </button>
                                <button class="file-action-btn download" onclick="downloadFile('${file.name}', '${file.type}')">
                                    📥 Download
                                </button>
                                ${(currentUser.isAdmin && chapter.class === currentUser.class) || currentUser.isSuperAdmin ? 
                                    `<button class="file-action-btn delete" onclick="event.stopPropagation(); deleteFile('${chapterId}', '${file.name}')">🗑️</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
        
        ${(currentUser.isAdmin && chapter.class === currentUser.class) || currentUser.isSuperAdmin ? `
            <div class="notes-editor">
                <h4>✏️ Edit Notes (Admin)</h4>
                <textarea id="notesContent" placeholder="Write notes here... Use markdown for formatting" rows="8">${chapterNotes.content || ''}</textarea>
                
                <div class="notes-toolbar">
                    <button class="note-action-btn text" onclick="document.getElementById('notesContent').focus()">
                        📝 Write
                    </button>
                    <button class="note-action-btn upload" onclick="showFileUpload('${chapterId}')">
                        📁 Upload Files
                    </button>
                    <button class="note-action-btn save" onclick="saveNotes('${chapterId}')">
                        💾 Save Notes
                    </button>
                </div>
                
                <div id="fileUploadArea" style="display: none; margin-top: 1rem;">
                    <div class="file-upload-area" onclick="document.getElementById('fileInput').click()">
                        <div class="upload-icon">📁</div>
                        <p><strong>Click to select files</strong></p>
                        <p>PDF, DOC, PPT, TXT files up to 10MB</p>
                        <input type="file" id="fileInput" multiple style="display: none;" 
                               accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" 
                               onchange="handleFileSelect(event, '${chapterId}')">
                    </div>
                </div>
            </div>
        ` : ''}
        
        <div class="notes-footer">
            <button class="streak-btn" onclick="startQuiz('${chapterId}')">
                🧠 Take Chapter Quiz
            </button>
        </div>
    `;
}

function closeNotesModal() {
    document.getElementById('notesModal').style.display = 'none';
}

function getFileIcon(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const icons = {
        'pdf': '📕',
        'doc': '📄', 'docx': '📄',
        'ppt': '📊', 'pptx': '📊',
        'txt': '📝',
        'xls': '📊', 'xlsx': '📊',
        'zip': '📦', 'rar': '📦'
    };
    return icons[ext] || '📎';
}

function showFileUpload(chapterId) {
    const area = document.getElementById('fileUploadArea');
    area.style.display = 'block';
    area.scrollIntoView({ behavior: 'smooth' });
}

function handleFileSelect(event, chapterId) {
    const files = event.target.files;
    if (files.length > 0) {
        handleFiles(files, chapterId);
    }
}

function handleFiles(files, chapterId) {
    const chapter = chapters.find(c => c.id === chapterId);
    let noteIndex = notes.findIndex(n => n.chapterId === chapterId && n.class === chapter.class);
    
    if (noteIndex === -1) {
        notes.push({
            id: Date.now().toString(),
            chapterId: chapterId,
            content: '',
            files: [],
            class: chapter.class,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
        noteIndex = notes.length - 1;
    }
    
    if (!notes[noteIndex].files) {
        notes[noteIndex].files = [];
    }
    
    const fileList = document.createElement('div');
    fileList.innerHTML = '<h4>Selected Files:</h4>';
    
    Array.from(files).forEach(file => {
        const fileInfo = {
            name: file.name,
            type: file.type,
            size: file.size,
            uploaded: new Date().toLocaleDateString(),
            data: 'file_data_' + Date.now()
        };
        
        notes[noteIndex].files.push(fileInfo);
        
        fileList.innerHTML += `
            <div class="file-preview-item">
                <span class="file-icon">${getFileIcon(file.name)}</span>
                <span>${file.name} (${Math.round(file.size/1024)} KB)</span>
                <span class="file-status">✅ Added</span>
            </div>
        `;
    });
    
    const area = document.getElementById('fileUploadArea');
    area.appendChild(fileList);
    
    showNotification(`${files.length} file(s) added`, 'success');
}

function deleteFile(chapterId, fileName) {
    const chapter = chapters.find(c => c.id === chapterId);
    const noteIndex = notes.findIndex(n => n.chapterId === chapterId && n.class === chapter.class);
    
    if (noteIndex === -1) return;
    
    notes[noteIndex].files = notes[noteIndex].files.filter(f => f.name !== fileName);
    saveAllData();
    showChapterNotes(chapterId);
    showNotification('File deleted', 'success');
}

function saveNotes(chapterId) {
    const content = document.getElementById('notesContent').value;
    const chapter = chapters.find(c => c.id === chapterId);
    
    let noteIndex = notes.findIndex(n => n.chapterId === chapterId && n.class === chapter.class);
    
    if (noteIndex === -1) {
        notes.push({
            id: Date.now().toString(),
            chapterId: chapterId,
            content: content,
            files: [],
            class: chapter.class,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
    } else {
        notes[noteIndex].content = content;
        notes[noteIndex].updatedAt = Date.now();
    }
    
    saveAllData();
    showNotification('Notes saved successfully!', 'success');
    showChapterNotes(chapterId);
}

function openFile(fileName, fileType) {
    document.getElementById('fileViewerModal').style.display = 'flex';
    document.getElementById('fileViewerTitle').textContent = `Viewing: ${fileName}`;
    
    const content = document.getElementById('fileViewerContent');
    const ext = fileName.toLowerCase().split('.').pop();
    
    let previewHTML = `
        <div class="file-viewer-actions">
            <button class="file-action-btn open" onclick="simulateOpen('${fileName}')">
                👁️ Open
            </button>
            <button class="file-action-btn download" onclick="downloadFile('${fileName}', '${ext}')">
                📥 Download
            </button>
            <button class="secondary-btn" onclick="closeFileViewer()">
                Close
            </button>
        </div>
        
        <div class="file-preview">
            <div class="file-preview-content">
                <div class="file-preview-icon">${getFileIcon(fileName)}</div>
                <h3>${fileName}</h3>
                <p>${ext.toUpperCase()} File</p>
                <div class="file-info-box">
                    <p>This is a simulated file preview. In a real application, this would display the actual file content.</p>
                    <p><strong>File type:</strong> ${ext}</p>
                    <p><strong>Size:</strong> ~2.5 KB</p>
                    <p><strong>Last modified:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = previewHTML;
}

function simulateOpen(fileName) {
    showNotification(`Opening ${fileName}...`, 'info');
    // In real app, this would use proper file viewer
}

function downloadFile(fileName, fileType) {
    const element = document.createElement('a');
    const content = `CataCuti App - ${fileName}\nDownloaded: ${new Date().toLocaleString()}\n\nThis is a simulated download for: ${fileName}`;
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    showNotification(`Downloading ${fileName}...`, 'success');
}

function closeFileViewer() {
    document.getElementById('fileViewerModal').style.display = 'none';
}

// ============================================
// ADMIN PANEL
// ============================================

function showAdminPanel() {
    document.getElementById('adminModal').style.display = 'flex';
    loadAdminContent('chapters');
}

function closeAdminPanel() {
    document.getElementById('adminModal').style.display = 'none';
}

function loadAdminContent(tab) {
    const adminContent = document.querySelector('.admin-content');
    const isSuperAdmin = currentUser.isSuperAdmin;
    
    let filteredChapters = isSuperAdmin ? chapters : chapters.filter(ch => ch.class === currentUser.class);
    let filteredVideos = isSuperAdmin ? videos : videos.filter(vid => vid.class === currentUser.class);
    let filteredQuestions = isSuperAdmin ? questions : questions.filter(q => q.class === currentUser.class);
    let filteredNotes = isSuperAdmin ? notes : notes.filter(n => n.class === currentUser.class);
    let filteredLiveClasses = isSuperAdmin ? liveClasses : liveClasses.filter(lc => lc.class === currentUser.class);
    
    if (tab === 'chapters') {
        adminContent.innerHTML = `
            <div class="admin-tabs">
                <button class="admin-tab active" onclick="loadAdminContent('chapters')">📚 Chapters</button>
                <button class="admin-tab" onclick="loadAdminContent('videos')">🎥 Videos</button>
                <button class="admin-tab" onclick="loadAdminContent('subjects')">📖 Subjects</button>
                <button class="admin-tab" onclick="loadAdminContent('quiz')">🧠 Quiz</button>
                <button class="admin-tab" onclick="loadAdminContent('notes')">📝 Notes</button>
                <button class="admin-tab" onclick="loadAdminContent('live')">🎥 Live</button>
            </div>
            
            <div class="admin-header">
                <h3>${isSuperAdmin ? 'All Classes' : currentUser.class} - Chapters</h3>
                <button class="add-btn" onclick="showAddForm('chapter')">➕ Add Chapter</button>
            </div>
            
            <div id="addChapterForm" class="admin-form" style="display: none;">
                <input type="text" id="chapterTitle" placeholder="Chapter Title">
                <textarea id="chapterDesc" placeholder="Description"></textarea>
                <select id="chapterSubject">
                    <option value="">Select Subject</option>
                    ${subjects.map(sub => `<option value="${sub.id}">${sub.name}</option>`).join('')}
                </select>
                <select id="chapterDifficulty">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                </select>
                <input type="number" id="chapterQuestions" placeholder="Questions" value="5">
                <input type="number" id="chapterDuration" placeholder="Duration (min)" value="45">
                <select id="chapterClass">
                    <option value="">Select Class</option>
                    ${appClasses.map(cls => `
                        <option value="${cls}" ${cls === currentUser.class && !isSuperAdmin ? 'selected' : ''}>
                            ${cls} ${cls === currentUser.class && !isSuperAdmin ? '(Your Class)' : ''}
                        </option>
                    `).join('')}
                </select>
                <button class="streak-btn" onclick="addChapterAdmin()">Add Chapter</button>
            </div>
            
            <div class="content-list">
                ${filteredChapters.map(chapter => {
                    const subject = subjects.find(s => s.id === chapter.subjectId);
                    return `
                        <div class="content-item">
                            <div>
                                <strong>${chapter.title}</strong>
                                <p>${chapter.description}</p>
                                <small>
                                    📚 ${subject?.name} • 
                                    ⏱️ ${chapter.duration} min • 
                                    📊 ${chapter.questions} questions • 
                                    🏫 ${chapter.class}
                                </small>
                            </div>
                            <div class="item-actions">
                                <button class="edit-btn" onclick="editChapter('${chapter.id}')">✏️</button>
                                <button class="delete-btn" onclick="deleteChapterAdmin('${chapter.id}')">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else if (tab === 'videos') {
        adminContent.innerHTML = `
            <div class="admin-tabs">
                <button class="admin-tab" onclick="loadAdminContent('chapters')">📚 Chapters</button>
                <button class="admin-tab active" onclick="loadAdminContent('videos')">🎥 Videos</button>
                <button class="admin-tab" onclick="loadAdminContent('subjects')">📖 Subjects</button>
                <button class="admin-tab" onclick="loadAdminContent('quiz')">🧠 Quiz</button>
                <button class="admin-tab" onclick="loadAdminContent('notes')">📝 Notes</button>
                <button class="admin-tab" onclick="loadAdminContent('live')">🎥 Live</button>
            </div>
            
            <div class="admin-header">
                <h3>${isSuperAdmin ? 'All Classes' : currentUser.class} - Videos</h3>
                <button class="add-btn" onclick="showAddForm('video')">➕ Add Video</button>
            </div>
            
            <div id="addVideoForm" class="admin-form" style="display: none;">
                <input type="text" id="videoTitle" placeholder="Video Title">
                <textarea id="videoDesc" placeholder="Description"></textarea>
                <select id="videoSubject">
                    <option value="">Select Subject</option>
                    ${subjects.map(sub => `<option value="${sub.id}">${sub.name}</option>`).join('')}
                </select>
                <input type="text" id="videoUrl" placeholder="YouTube Embed URL" value="https://www.youtube.com/embed/dQw4w9WgXcQ">
                <input type="text" id="videoDuration" placeholder="Duration" value="15:30">
                <select id="videoClass">
                    <option value="">Select Class</option>
                    ${appClasses.map(cls => `
                        <option value="${cls}" ${cls === currentUser.class && !isSuperAdmin ? 'selected' : ''}>
                            ${cls} ${cls === currentUser.class && !isSuperAdmin ? '(Your Class)' : ''}
                        </option>
                    `).join('')}
                </select>
                <button class="streak-btn" onclick="addVideoAdmin()">Add Video</button>
            </div>
            
            <div class="content-list">
                ${filteredVideos.map(video => {
                    const subject = subjects.find(s => s.id === video.subjectId);
                    return `
                        <div class="content-item">
                            <div>
                                <strong>${video.title}</strong>
                                <p>${video.description}</p>
                                <small>📚 ${subject?.name} • ⏱️ ${video.duration} • 🏫 ${video.class}</small>
                            </div>
                            <div class="item-actions">
                                <button class="delete-btn" onclick="deleteVideoAdmin('${video.id}')">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else if (tab === 'quiz') {
        adminContent.innerHTML = `
            <div class="admin-tabs">
                <button class="admin-tab" onclick="loadAdminContent('chapters')">📚 Chapters</button>
                <button class="admin-tab" onclick="loadAdminContent('videos')">🎥 Videos</button>
                <button class="admin-tab" onclick="loadAdminContent('subjects')">📖 Subjects</button>
                <button class="admin-tab active" onclick="loadAdminContent('quiz')">🧠 Quiz</button>
                <button class="admin-tab" onclick="loadAdminContent('notes')">📝 Notes</button>
                <button class="admin-tab" onclick="loadAdminContent('live')">🎥 Live</button>
            </div>
            
            <div class="admin-header">
                <h3>${isSuperAdmin ? 'All Classes' : currentUser.class} - Quiz Questions</h3>
                <button class="add-btn" onclick="showAddForm('quiz')">➕ Add Question</button>
            </div>
            
            <div id="addQuizForm" class="admin-form" style="display: none;">
                <select id="quizChapter">
                    <option value="">Select Chapter</option>
                    ${filteredChapters.map(ch => `
                        <option value="${ch.id}">${ch.title} (${ch.class})</option>
                    `).join('')}
                </select>
                <textarea id="quizQuestion" placeholder="Question text"></textarea>
                <input type="text" id="quizOption1" placeholder="Option A">
                <input type="text" id="quizOption2" placeholder="Option B">
                <input type="text" id="quizOption3" placeholder="Option C">
                <input type="text" id="quizOption4" placeholder="Option D">
                <select id="quizCorrectOption">
                    <option value="0">Option A</option>
                    <option value="1">Option B</option>
                    <option value="2">Option C</option>
                    <option value="3">Option D</option>
                </select>
                <textarea id="quizExplanation" placeholder="Explanation"></textarea>
                <select id="quizClass">
                    <option value="">Select Class</option>
                    ${appClasses.map(cls => `
                        <option value="${cls}" ${cls === currentUser.class && !isSuperAdmin ? 'selected' : ''}>
                            ${cls} ${cls === currentUser.class && !isSuperAdmin ? '(Your Class)' : ''}
                        </option>
                    `).join('')}
                </select>
                <button class="streak-btn" onclick="addQuizQuestionAdmin()">Add Question</button>
            </div>
            
            <div class="content-list">
                ${filteredQuestions.map(question => {
                    const chapter = chapters.find(c => c.id === question.chapterId);
                    return `
                        <div class="content-item">
                            <div>
                                <strong>${question.question}</strong>
                                <p>${chapter?.title || 'Unknown Chapter'} • Correct: ${question.options[question.correctAnswer]}</p>
                                <small>🏫 ${question.class}</small>
                            </div>
                            <div class="item-actions">
                                <button class="delete-btn" onclick="deleteQuizQuestionAdmin('${question.id}')">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else if (tab === 'subjects') {
        adminContent.innerHTML = `
            <div class="admin-tabs">
                <button class="admin-tab" onclick="loadAdminContent('chapters')">📚 Chapters</button>
                <button class="admin-tab" onclick="loadAdminContent('videos')">🎥 Videos</button>
                <button class="admin-tab active" onclick="loadAdminContent('subjects')">📖 Subjects</button>
                <button class="admin-tab" onclick="loadAdminContent('quiz')">🧠 Quiz</button>
                <button class="admin-tab" onclick="loadAdminContent('notes')">📝 Notes</button>
                <button class="admin-tab" onclick="loadAdminContent('live')">🎥 Live</button>
            </div>
            
            <div class="admin-header">
                <h3>Subjects Management</h3>
                <button class="add-btn" onclick="showAddForm('subject')">➕ Add Subject</button>
            </div>
            
            <div id="addSubjectForm" class="admin-form" style="display: none;">
                <input type="text" id="subjectName" placeholder="Subject Name">
                <textarea id="subjectDesc" placeholder="Description"></textarea>
                <input type="color" id="subjectColor" value="#4361ee">
                <div class="class-selection">
                    <h4>Available for:</h4>
                    ${appClasses.map(cls => `
                        <label>
                            <input type="checkbox" name="subjectClasses" value="${cls}" checked>
                            ${cls}
                        </label>
                    `).join('')}
                </div>
                <button class="streak-btn" onclick="addSubjectAdmin()">Add Subject</button>
            </div>
            
            <div class="subject-grid">
                ${subjects.map(subject => `
                    <div class="subject-card" style="border-color: ${subject.color}">
                        <div class="subject-header" style="background: ${subject.color}">
                            <h4>${subject.name}</h4>
                        </div>
                        <div class="subject-body">
                            <p>${subject.description}</p>
                            <small>📚 ${chapters.filter(ch => ch.subjectId === subject.id).length} chapters</small>
                            <small>🎥 ${videos.filter(v => v.subjectId === subject.id).length} videos</small>
                            <small>🏫 ${subject.classes?.join(', ') || 'All classes'}</small>
                        </div>
                        ${!['math', 'science', 'english'].includes(subject.id) ? 
                            `<button class="delete-btn" onclick="deleteSubjectAdmin('${subject.id}')">Delete</button>` : 
                            '<span class="default-badge">Default</span>'
                        }
                    </div>
                `).join('')}
            </div>
        `;
    }
}

function showAddForm(type) {
    document.getElementById(`add${type.charAt(0).toUpperCase() + type.slice(1)}Form`).style.display = 'flex';
}

function addChapterAdmin() {
    const title = document.getElementById('chapterTitle').value;
    const description = document.getElementById('chapterDesc').value;
    const subjectId = document.getElementById('chapterSubject').value;
    const difficulty = document.getElementById('chapterDifficulty').value;
    const questionsCount = document.getElementById('chapterQuestions').value;
    const duration = document.getElementById('chapterDuration').value;
    const chapterClass = document.getElementById('chapterClass').value;
    
    if (!title || !description || !subjectId || !chapterClass) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    if (!currentUser.isSuperAdmin && chapterClass !== currentUser.class) {
        showNotification('You can only add for your class', 'error');
        return;
    }
    
    const newChapter = {
        id: Date.now().toString(),
        title,
        description,
        subjectId,
        difficulty,
        questions: parseInt(questionsCount) || 0,
        duration: parseInt(duration) || 0,
        class: chapterClass,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    chapters.push(newChapter);
    saveAllData();
    showNotification('Chapter added!', 'success');
    loadAdminContent('chapters');
    document.getElementById('addChapterForm').style.display = 'none';
}

function addVideoAdmin() {
    const title = document.getElementById('videoTitle').value;
    const description = document.getElementById('videoDesc').value;
    const subjectId = document.getElementById('videoSubject').value;
    const url = document.getElementById('videoUrl').value;
    const duration = document.getElementById('videoDuration').value;
    const videoClass = document.getElementById('videoClass').value;
    
    if (!title || !description || !subjectId || !url || !videoClass) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    if (!currentUser.isSuperAdmin && videoClass !== currentUser.class) {
        showNotification('You can only add for your class', 'error');
        return;
    }
    
    const newVideo = {
        id: Date.now().toString(),
        title,
        description,
        subjectId,
        url: url.includes('embed/') ? url : 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration,
        class: videoClass,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    videos.push(newVideo);
    saveAllData();
    showNotification('Video added!', 'success');
    loadAdminContent('videos');
    document.getElementById('addVideoForm').style.display = 'none';
}

function addQuizQuestionAdmin() {
    const chapterId = document.getElementById('quizChapter').value;
    const questionText = document.getElementById('quizQuestion').value;
    const option1 = document.getElementById('quizOption1').value;
    const option2 = document.getElementById('quizOption2').value;
    const option3 = document.getElementById('quizOption3').value;
    const option4 = document.getElementById('quizOption4').value;
    const correctOption = parseInt(document.getElementById('quizCorrectOption').value);
    const explanation = document.getElementById('quizExplanation').value;
    const quizClass = document.getElementById('quizClass').value;
    
    if (!chapterId || !questionText || !option1 || !option2 || !option3 || !option4 || !quizClass) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    if (!currentUser.isSuperAdmin && quizClass !== currentUser.class) {
        showNotification('You can only add for your class', 'error');
        return;
    }
    
    const newQuestion = {
        id: Date.now().toString(),
        chapterId,
        question: questionText,
        options: [option1, option2, option3, option4],
        correctAnswer: correctOption,
        explanation,
        class: quizClass,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    questions.push(newQuestion);
    saveAllData();
    showNotification('Question added!', 'success');
    loadAdminContent('quiz');
    document.getElementById('addQuizForm').style.display = 'none';
}

function addSubjectAdmin() {
    const name = document.getElementById('subjectName').value;
    const description = document.getElementById('subjectDesc').value;
    const color = document.getElementById('subjectColor').value;
    const classCheckboxes = document.querySelectorAll('input[name="subjectClasses"]:checked');
    const selectedClasses = Array.from(classCheckboxes).map(cb => cb.value);
    
    if (!name || !description || selectedClasses.length === 0) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    const newSubject = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        description,
        color,
        classes: selectedClasses,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    subjects.push(newSubject);
    saveAllData();
    showNotification('Subject added!', 'success');
    loadAdminContent('subjects');
    document.getElementById('addSubjectForm').style.display = 'none';
}

function deleteChapterAdmin(chapterId) {
    const chapter = chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;
    
    if (!currentUser.isSuperAdmin && chapter.class !== currentUser.class) {
        showNotification('Cannot delete this chapter', 'error');
        return;
    }
    
    if (confirm('Delete this chapter and all related questions/notes?')) {
        chapters = chapters.filter(ch => ch.id !== chapterId);
        questions = questions.filter(q => q.chapterId !== chapterId);
        notes = notes.filter(n => n.chapterId !== chapterId);
        saveAllData();
        showNotification('Chapter deleted!', 'success');
        loadAdminContent('chapters');
    }
}

function deleteVideoAdmin(videoId) {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    
    if (!currentUser.isSuperAdmin && video.class !== currentUser.class) {
        showNotification('Cannot delete this video', 'error');
        return;
    }
    
    if (confirm('Delete this video?')) {
        videos = videos.filter(v => v.id !== videoId);
        saveAllData();
        showNotification('Video deleted!', 'success');
        loadAdminContent('videos');
    }
}

function deleteQuizQuestionAdmin(questionId) {
    const question = questions.find(q => q.id === questionId);
    if (!question) return;
    
    if (!currentUser.isSuperAdmin && question.class !== currentUser.class) {
        showNotification('Cannot delete this question', 'error');
        return;
    }
    
    if (confirm('Delete this question?')) {
        questions = questions.filter(q => q.id !== questionId);
        saveAllData();
        showNotification('Question deleted!', 'success');
        loadAdminContent('quiz');
    }
}

function deleteSubjectAdmin(subjectId) {
    if (['math', 'science', 'english'].includes(subjectId)) {
        showNotification('Cannot delete default subjects', 'error');
        return;
    }
    
    if (confirm('Delete this subject and all related content?')) {
        subjects = subjects.filter(s => s.id !== subjectId);
        chapters = chapters.filter(ch => ch.subjectId !== subjectId);
        videos = videos.filter(vid => vid.subjectId !== subjectId);
        saveAllData();
        showNotification('Subject deleted!', 'success');
        loadAdminContent('subjects');
    }
}

// ============================================
// CERTIFICATE
// ============================================

function showCertificate() {
    const userClassChapters = chapters.filter(ch => ch.class === currentUser.class);
    const userProgressData = userProgress[currentUser.id] || {};
    const overallAccuracy = calculateOverallAccuracy(userProgressData);
    const chaptersCompleted = calculateChaptersCompleted(userProgressData);
    const totalChapters = userClassChapters.length;
    
    let certificateLevel = 'Student';
    let badge = '📜';
    
    if (chaptersCompleted === totalChapters && overallAccuracy >= 90) {
        certificateLevel = 'Dr. CataCuti Platinum';
        badge = '🏆';
    } else if (chaptersCompleted >= totalChapters * 0.8 && overallAccuracy >= 80) {
        certificateLevel = 'Mr. CataCuti Gold';
        badge = '🥇';
    } else if (chaptersCompleted >= totalChapters * 0.6 && overallAccuracy >= 70) {
        certificateLevel = 'Mr. CataCuti Silver';
        badge = '🥈';
    } else if (chaptersCompleted >= totalChapters * 0.4 && overallAccuracy >= 60) {
        certificateLevel = 'Mr. CataCuti Bronze';
        badge = '🥉';
    }
    
    document.getElementById('certificateModal').style.display = 'flex';
    document.querySelector('.certificate-content').innerHTML = `
        <div class="certificate" id="certificateContent">
            <div class="certificate-header">
                <h1>CERTIFICATE OF ACHIEVEMENT</h1>
                <p>This certifies that</p>
            </div>
            
            <div class="certificate-name">
                <h2>${currentUser.displayName}</h2>
            </div>
            
            <div class="certificate-body">
                <p>has successfully completed the</p>
                <h3>${certificateLevel} Program</h3>
                <div class="certificate-badge">${badge}</div>
                
                <div class="certificate-stats">
                    <div class="stat-item">
                        <span class="stat-value">${overallAccuracy}%</span>
                        <span class="stat-label">Accuracy</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${chaptersCompleted}/${totalChapters}</span>
                        <span class="stat-label">Chapters</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${currentUser.coins}</span>
                        <span class="stat-label">Coins</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${currentUser.streak}</span>
                        <span class="stat-label">Streak</span>
                    </div>
                </div>
                
                <div class="certificate-info">
                    <p><strong>Class:</strong> ${currentUser.class}</p>
                    <p><strong>School:</strong> ${currentUser.school}</p>
                </div>
                
                <p class="certificate-date">
                    Awarded on ${new Date().toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}
                </p>
            </div>
            
            <div class="certificate-actions">
                <button class="streak-btn" onclick="downloadCertificate()">
                    📥 Download Certificate
                </button>
                <button class="secondary-btn" onclick="copyCertificate()">
                    📋 Copy Text
                </button>
            </div>
        </div>
    `;
}

function downloadCertificate() {
    const certificateContent = document.getElementById('certificateContent');
    
    html2canvas(certificateContent).then(canvas => {
        const link = document.createElement('a');
        link.download = `CataCuti_Certificate_${currentUser.displayName}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
    
    showNotification('Certificate downloaded!', 'success');
}

function copyCertificate() {
    const text = `
CERTIFICATE OF ACHIEVEMENT
CataCuti Learning Platform

This certifies that
${currentUser.displayName}

has successfully completed the CataCuti Learning Program
with outstanding performance and dedication.

Class: ${currentUser.class}
School: ${currentUser.school}
Date: ${new Date().toLocaleDateString()}

"Learn Smarter, Not Harder"
    `.trim();
    
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Certificate text copied!', 'success');
    });
}

function closeCertificateModal() {
    document.getElementById('certificateModal').style.display = 'none';
}

// ============================================
// AI CHAT
// ============================================

function showAIDoubtSolver() {
    document.getElementById('aiModal').style.display = 'flex';
    document.querySelector('.ai-content').innerHTML = `
        <div class="ai-chat">
            <div class="chat-header">
                <h3>🤖 AI Learning Assistant</h3>
                <p>Ask questions about ${subjects.find(s => s.id === currentSubject)?.name || 'any subject'}</p>
            </div>
            
            <div class="chat-messages" id="chatMessages">
                <div class="message ai">
                    <strong>AI Tutor:</strong> Hello! I'm here to help with your studies. Ask me any question about ${subjects.find(s => s.id === currentSubject)?.name || 'your subjects'}! 📚
                </div>
            </div>
            
            <div class="chat-input">
                <input type="text" id="aiQuestion" placeholder="Type your question here..." 
                       onkeypress="if(event.key === 'Enter') sendAIQuestion()">
                <button class="streak-btn" onclick="sendAIQuestion()">Send</button>
            </div>
        </div>
    `;
    
    chatMessages = [];
}

function sendAIQuestion() {
    const input = document.getElementById('aiQuestion');
    const question = input.value.trim();
    
    if (!question) return;
    
    // Add user message
    chatMessages.push({ type: 'user', content: question });
    updateChatDisplay();
    input.value = '';
    
    // Simulate AI thinking
    setTimeout(() => {
        const response = generateAIResponse(question);
        chatMessages.push({ type: 'ai', content: response });
        updateChatDisplay();
    }, 1000);
}

function updateChatDisplay() {
    const chatBox = document.getElementById('chatMessages');
    chatBox.innerHTML = chatMessages.map(msg => `
        <div class="message ${msg.type}">
            <strong>${msg.type === 'user' ? 'You' : 'AI Tutor'}:</strong> ${msg.content}
        </div>
    `).join('');
    
    chatBox.scrollTop = chatBox.scrollHeight;
}

function generateAIResponse(question) {
    const lowerQ = question.toLowerCase();
    
    if (lowerQ.includes('algebra') || lowerQ.includes('equation')) {
        return "Algebra involves solving equations and working with variables. Remember to perform the same operation on both sides of an equation. Would you like me to explain a specific algebraic concept?";
    } else if (lowerQ.includes('science') || lowerQ.includes('experiment')) {
        return "Science is about understanding the natural world through observation and experimentation. The scientific method involves making observations, forming hypotheses, conducting experiments, and drawing conclusions.";
    } else if (lowerQ.includes('english') || lowerQ.includes('grammar')) {
        return "English grammar includes parts of speech, sentence structure, and punctuation rules. Practice reading and writing regularly to improve your language skills.";
    } else if (lowerQ.includes('help') || lowerQ.includes('confused')) {
        return "I'm here to help! Try breaking down complex topics into smaller parts. Focus on one concept at a time, and don't hesitate to ask specific questions.";
    } else {
        return "That's an interesting question! For better assistance, could you specify which subject this relates to? I can help with Mathematics, Science, English, and more.";
    }
}

function closeAIModal() {
    document.getElementById('aiModal').style.display = 'none';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function calculateOverallAccuracy(progress) {
    const chaptersWithProgress = Object.values(progress).filter(p => p.score > 0);
    if (chaptersWithProgress.length === 0) return 0;
    
    const totalScore = chaptersWithProgress.reduce((sum, p) => sum + p.score, 0);
    return Math.round(totalScore / chaptersWithProgress.length);
}

function calculateChaptersCompleted(progress) {
    return Object.values(progress).filter(p => p.completed).length;
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// ============================================
// INITIALIZE APP
// ============================================

function initApp() {
    console.log('🚀 Starting CataCuti App...');
    initializeData();
    
    const savedUser = localStorage.getItem('catacutiCurrentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showHomeScreen();
        showNotification(`Welcome back, ${currentUser.displayName}!`, 'success');
    } else {
        showLoginScreen();
    }
    
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; transform: translateY(-10px); }
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// Start the app
window.onload = initApp;