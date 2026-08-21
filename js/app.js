const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;

// ============ UTILITY ============
function $(id) { return document.getElementById(id); }

function showMessage(text, type) {
    const el = $('message');
    el.textContent = text;
    el.className = type;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
}

function toggleAuth(showLogin) {
    $('login-form').style.display = showLogin ? 'block' : 'none';
    $('signup-form').style.display = showLogin ? 'none' : 'block';
}

// ============ AUTH ============
$('show-signup').addEventListener('click', (e) => { e.preventDefault(); toggleAuth(false); });
$('show-login').addEventListener('click', (e) => { e.preventDefault(); toggleAuth(true); });

$('signup-btn').addEventListener('click', async () => {
    const name = $('signup-name').value.trim();
    const email = $('signup-email').value.trim();
    const password = $('signup-password').value;
    const role = $('signup-role').value;

    if (!name || !email || !password) { showMessage('Fill all fields', 'error'); return; }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, role } }
    });

    if (error) { showMessage(error.message, 'error'); } else { showMessage('Account created! You can now login.', 'success'); toggleAuth(true); }
});

$('login-btn').addEventListener('click', async () => {
    const email = $('login-email').value.trim();
    const password = $('login-password').value;

    if (!email || !password) { showMessage('Fill all fields', 'error'); return; }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { showMessage(error.message, 'error'); return; }

    currentUser = data.user;
    await loadProfile();
});

$('admin-logout-btn')?.addEventListener('click', logout);
$('student-logout-btn')?.addEventListener('click', logout);

async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    $('auth-container').style.display = 'block';
    $('admin-dashboard').style.display = 'none';
    $('student-dashboard').style.display = 'none';
}

// ============ PROFILE ============
async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    currentProfile = data;
    $('auth-container').style.display = 'none';

    if (currentProfile?.role === 'admin') {
        $('admin-dashboard').style.display = 'flex';
        loadAdminData();
    } else {
        $('student-dashboard').style.display = 'flex';
        loadStudentData();
    }
}

// ============ NAVIGATION ============
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.dataset.section;
        const parent = link.closest('.sidebar').parentElement;
        parent.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        parent.querySelectorAll('.section').forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
        link.classList.add('active');
        const section = $(target);
        section.style.display = 'block';
        section.classList.add('active');
    });
});

// ============ ADMIN DATA ============
async function loadAdminData() {
    await Promise.all([
        loadStudents(),
        loadSubjectsForAdmin(),
        loadSubjectsForLevels(),
        loadSubjectsForContent(),
        loadSubjectsForQuestions(),
        loadTests(),
        loadSubjectsForTestCreation()
    ]);
}

async function loadStudents() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false });
    const list = $('students-list');
    if (!data?.length) { list.innerHTML = '<div class="empty-state">No students registered yet.</div>'; return; }
    list.innerHTML = data.map(s => `
        <div class="card">
            <div class="card-info">
                <h3>${s.full_name || 'Unnamed'}</h3>
                <p>${s.email || s.id}</p>
            </div>
            <div class="card-actions">
                <span style="font-size:12px;color:#999;">Joined ${new Date(s.created_at).toLocaleDateString()}</span>
            </div>
        </div>
    `).join('');
}

// ============ SUBJECTS ============
async function loadSubjectsForAdmin() {
    const { data } = await supabase.from('subjects').select('*').order('created_at', { ascending: false });
    const list = $('subjects-list');
    if (!data?.length) { list.innerHTML = '<div class="empty-state">No subjects yet.</div>'; return; }
    list.innerHTML = data.map(s => `
        <div class="card">
            <div class="card-info">
                <h3>${s.name}</h3>
                <p>${s.description || 'No description'}</p>
            </div>
            <div class="card-actions">
                <button class="btn-sm btn-danger" onclick="deleteSubject('${s.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

async function loadSubjectsForLevels() {
    const { data } = await supabase.from('subjects').select('*').order('name');
    const sel = $('level-subject-select');
    sel.innerHTML = '<option value="">Select Subject</option>' + (data || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

async function loadSubjectsForContent() {
    const { data } = await supabase.from('subjects').select('*').order('name');
    const sel = $('content-subject-select');
    sel.innerHTML = '<option value="">Select Subject</option>' + (data || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

async function loadSubjectsForQuestions() {
    const { data } = await supabase.from('subjects').select('*').order('name');
    const sel = $('q-subject-select');
    sel.innerHTML = '<option value="">Select Subject</option>' + (data || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

async function loadSubjectsForTestCreation() {
    const { data } = await supabase.from('subjects').select('*').order('name');
    const sel = $('test-subject-select');
    sel.innerHTML = '<option value="">Select Subject</option>' + (data || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

$('add-subject-btn').addEventListener('click', async () => {
    const name = $('subject-name').value.trim();
    const desc = $('subject-desc').value.trim();
    if (!name) return;
    await supabase.from('subjects').insert({ name, description: desc, created_by: currentUser.id });
    $('subject-name').value = '';
    $('subject-desc').value = '';
    await Promise.all([loadSubjectsForAdmin(), loadSubjectsForLevels(), loadSubjectsForContent(), loadSubjectsForQuestions(), loadSubjectsForTestCreation()]);
});

window.deleteSubject = async (id) => {
    if (!confirm('Delete this subject and all its levels/content?')) return;
    await supabase.from('subjects').delete().eq('id', id);
    await Promise.all([loadSubjectsForAdmin(), loadSubjectsForLevels(), loadSubjectsForContent(), loadSubjectsForQuestions(), loadSubjectsForTestCreation()]);
};

// ============ LEVELS ============
$('level-subject-select').addEventListener('change', async (e) => {
    const subjectId = e.target.value;
    if (!subjectId) { $('levels-list').innerHTML = ''; return; }
    const { data } = await supabase.from('levels').select('*').eq('subject_id', subjectId).order('level_number');
    const list = $('levels-list');
    if (!data?.length) { list.innerHTML = '<div class="empty-state">No levels for this subject.</div>'; return; }
    list.innerHTML = data.map(l => `
        <div class="card">
            <div class="card-info">
                <h3>${l.name}</h3>
                <p>Level ${l.level_number}</p>
            </div>
            <div class="card-actions">
                <button class="btn-sm btn-danger" onclick="deleteLevel('${l.id}')">Delete</button>
            </div>
        </div>
    `).join('');
});

$('add-level-btn').addEventListener('click', async () => {
    const subjectId = $('level-subject-select').value;
    const name = $('level-name').value.trim();
    const levelNum = parseInt($('level-number').value);
    if (!subjectId || !name || !levelNum) return;
    const { error } = await supabase.from('levels').insert({ subject_id: subjectId, name, level_number: levelNum });
    if (error) { alert('Error: ' + error.message); return; }
    $('level-name').value = '';
    $('level-number').value = '';
    $('level-subject-select').dispatchEvent(new Event('change'));
});

window.deleteLevel = async (id) => {
    if (!confirm('Delete this level and its content/questions?')) return;
    await supabase.from('levels').delete().eq('id', id);
    $('level-subject-select').dispatchEvent(new Event('change'));
};

// ============ CONTENTS ============
$('content-subject-select').addEventListener('change', async (e) => {
    const subjectId = e.target.value;
    const levelSel = $('content-level-select');
    if (!subjectId) { levelSel.innerHTML = '<option value="">Select Level</option>'; return; }
    const { data } = await supabase.from('levels').select('*').eq('subject_id', subjectId).order('level_number');
    levelSel.innerHTML = '<option value="">Select Level</option>' + (data || []).map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    loadContentsForLevel(null);
});

$('content-level-select').addEventListener('change', (e) => loadContentsForLevel(e.target.value));

async function loadContentsForLevel(levelId) {
    const list = $('contents-list');
    if (!levelId) { list.innerHTML = ''; return; }
    const { data } = await supabase.from('contents').select('*').eq('level_id', levelId).order('created_at', { ascending: false });
    if (!data?.length) { list.innerHTML = '<div class="empty-state">No content for this level.</div>'; return; }
    list.innerHTML = data.map(c => `
        <div class="card">
            <div class="card-info">
                <h3>${c.title}</h3>
                <p>${c.body.substring(0, 100)}...</p>
            </div>
            <div class="card-actions">
                <button class="btn-sm btn-danger" onclick="deleteContent('${c.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

$('add-content-btn').addEventListener('click', async () => {
    const levelId = $('content-level-select').value;
    const title = $('content-title').value.trim();
    const body = $('content-body').value.trim();
    if (!levelId || !title || !body) return;
    await supabase.from('contents').insert({ level_id: levelId, title, body });
    $('content-title').value = '';
    $('content-body').value = '';
    loadContentsForLevel(levelId);
});

window.deleteContent = async (id) => {
    if (!confirm('Delete this content?')) return;
    await supabase.from('contents').delete().eq('id', id);
    loadContentsForLevel($('content-level-select').value);
};

// ============ QUESTIONS ============
$('q-subject-select').addEventListener('change', async (e) => {
    const subjectId = e.target.value;
    const levelSel = $('q-level-select');
    if (!subjectId) { levelSel.innerHTML = '<option value="">Select Level</option>'; return; }
    const { data } = await supabase.from('levels').select('*').eq('subject_id', subjectId).order('level_number');
    levelSel.innerHTML = '<option value="">Select Level</option>' + (data || []).map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    loadQuestionsForLevel(null);
});

$('q-level-select').addEventListener('change', (e) => loadQuestionsForLevel(e.target.value));

async function loadQuestionsForLevel(levelId) {
    const list = $('questions-list');
    if (!levelId) { list.innerHTML = ''; return; }
    const { data } = await supabase.from('questions').select('*').eq('level_id', levelId).order('created_at', { ascending: false });
    if (!data?.length) { list.innerHTML = '<div class="empty-state">No questions for this level yet.</div>'; return; }
    list.innerHTML = data.map(q => `
        <div class="card">
            <div class="card-info">
                <h3>${q.question_text}</h3>
                <p>A: ${q.option_a} | B: ${q.option_b} | C: ${q.option_c} | D: ${q.option_d} | Answer: ${q.correct_answer}</p>
            </div>
            <div class="card-actions">
                <button class="btn-sm btn-danger" onclick="deleteQuestion('${q.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

$('generate-questions-btn').addEventListener('click', async () => {
    const levelId = $('q-level-select').value;
    if (!levelId) { alert('Select a level first'); return; }

    const statusEl = $('ai-status');
    statusEl.style.display = 'block';
    statusEl.textContent = 'Fetching content...';

    // Get content for this level
    const { data: contents } = await supabase.from('contents').select('*').eq('level_id', levelId);
    if (!contents?.length) { statusEl.textContent = 'No content found for this level. Add content first.'; return; }

    const contentText = contents.map(c => c.title + '\n' + c.body).join('\n\n');
    statusEl.textContent = 'Generating questions with AI...';

    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-questions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ content: contentText, level_id: levelId })
        });

        const result = await res.json();
        if (result.error) { statusEl.textContent = 'Error: ' + result.error; return; }

        statusEl.textContent = `Generated ${result.questions?.length || 0} questions!`;
        loadQuestionsForLevel(levelId);
    } catch (err) {
        statusEl.textContent = 'Error: ' + err.message;
    }
});

window.deleteQuestion = async (id) => {
    if (!confirm('Delete this question?')) return;
    await supabase.from('questions').delete().eq('id', id);
    loadQuestionsForLevel($('q-level-select').value);
};

// ============ TESTS (ADMIN) ============
async function loadTests() {
    const { data } = await supabase.from('tests').select('*, subjects(name), levels(name)').order('created_at', { ascending: false });
    const list = $('tests-list');
    if (!data?.length) { list.innerHTML = '<div class="empty-state">No tests created yet.</div>'; return; }
    list.innerHTML = data.map(t => `
        <div class="card">
            <div class="card-info">
                <h3>${t.title}</h3>
                <p>${t.subjects?.name || ''} - ${t.levels?.name || ''} | ${t.time_limit_minutes} min | <strong>${t.status}</strong></p>
            </div>
            <div class="card-actions">
                ${t.status === 'draft' ? `<button class="btn-sm btn-success" onclick="publishTest('${t.id}')">Publish</button>` : ''}
                ${t.status === 'published' ? `<button class="btn-sm btn-warning" onclick="closeTest('${t.id}')">Close</button>` : ''}
                <button class="btn-sm btn-danger" onclick="deleteTest('${t.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

window.publishTest = async (id) => {
    await supabase.from('tests').update({ status: 'published' }).eq('id', id);
    loadTests();
};

window.closeTest = async (id) => {
    await supabase.from('tests').update({ status: 'closed' }).eq('id', id);
    loadTests();
};

window.deleteTest = async (id) => {
    if (!confirm('Delete this test?')) return;
    await supabase.from('tests').delete().eq('id', id);
    loadTests();
};

// ============ CREATE TEST ============
$('test-subject-select').addEventListener('change', async (e) => {
    const subjectId = e.target.value;
    const levelSel = $('test-level-select');
    if (!subjectId) { levelSel.innerHTML = '<option value="">Select Level</option>'; return; }
    const { data } = await supabase.from('levels').select('*').eq('subject_id', subjectId).order('level_number');
    levelSel.innerHTML = '<option value="">Select Level</option>' + (data || []).map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    $('test-questions-checklist').innerHTML = '';
});

$('test-level-select').addEventListener('change', async (e) => {
    const levelId = e.target.value;
    const checklist = $('test-questions-checklist');
    if (!levelId) { checklist.innerHTML = ''; return; }
    const { data } = await supabase.from('questions').select('*').eq('level_id', levelId);
    if (!data?.length) { checklist.innerHTML = '<p style="color:#999;">No questions available for this level.</p>'; return; }
    checklist.innerHTML = '<label style="font-weight:600;">Select Questions:</label>' + data.map(q => `
        <label class="question-check" style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #eee;">
            <input type="checkbox" value="${q.id}" checked>
            <span style="font-size:13px;">${q.question_text}</span>
        </label>
    `).join('');
});

$('create-test-btn').addEventListener('click', async () => {
    const title = $('test-title').value.trim();
    const subjectId = $('test-subject-select').value;
    const levelId = $('test-level-select').value;
    const status = $('test-status').value;
    const timeLimit = parseInt($('test-time').value);

    if (!title || !subjectId || !levelId) { alert('Fill all fields'); return; }

    const checkedBoxes = document.querySelectorAll('#test-questions-checklist input[type="checkbox"]:checked');
    const questionIds = Array.from(checkedBoxes).map(cb => cb.value);
    if (!questionIds.length) { alert('Select at least one question'); return; }

    const { data: test, error } = await supabase.from('tests').insert({
        title, subject_id: subjectId, level_id: levelId, time_limit_minutes: timeLimit, status, created_by: currentUser.id
    }).select().single();

    if (error) { alert(error.message); return; }

    $('test-title').value = '';
    $('test-questions-checklist').innerHTML = '';
    loadTests();
    alert('Test created successfully!');
});

// ============ STUDENT DATA ============
async function loadStudentData() {
    await Promise.all([loadAvailableTests(), loadMyResults()]);
}

async function loadAvailableTests() {
    const { data } = await supabase.from('tests').select('*, subjects(name), levels(name)').eq('status', 'published').order('created_at', { ascending: false });
    const list = $('available-tests-list');
    if (!data?.length) { list.innerHTML = '<div class="empty-state">No tests available right now.</div>'; return; }

    // Check which tests already taken
    const { data: submissions } = await supabase.from('test_submissions').select('test_id').eq('student_id', currentUser.id);
    const takenIds = new Set((submissions || []).map(s => s.test_id));

    list.innerHTML = data.map(t => {
        const taken = takenIds.has(t.id);
        return `
        <div class="card">
            <div class="card-info">
                <h3>${t.title}</h3>
                <p>${t.subjects?.name || ''} - ${t.levels?.name || ''} | ${t.time_limit_minutes} minutes</p>
            </div>
            <div class="card-actions">
                ${taken ? '<span style="color:#27ae60;font-size:13px;">Completed</span>' : `<button class="btn-sm btn-success" onclick="startTest('${t.id}')">Start Test</button>`}
            </div>
        </div>
    `}).join('');
}

async function loadMyResults() {
    const { data } = await supabase.from('test_submissions').select('*, tests(title, subjects(name), levels(name))').eq('student_id', currentUser.id).order('submitted_at', { ascending: false });
    const list = $('my-results-list');
    if (!data?.length) { list.innerHTML = '<div class="empty-state">No results yet.</div>'; return; }
    list.innerHTML = data.map(r => {
        const pct = r.total_questions > 0 ? Math.round((r.score / r.total_questions) * 100) : 0;
        return `
        <div class="card">
            <div class="card-info">
                <h3>${r.tests?.title || 'Test'}</h3>
                <p>${r.tests?.subjects?.name || ''} - ${r.tests?.levels?.name || ''} | Score: ${r.score}/${r.total_questions} (${pct}%)</p>
            </div>
            <div class="card-actions">
                <span style="font-size:12px;color:#999;">${new Date(r.submitted_at).toLocaleString()}</span>
            </div>
        </div>
    `}).join('');
}

// ============ TEST TAKING ============
let activeTest = null;
let testQuestions = [];
let testTimer = null;
let timeRemaining = 0;

window.startTest = async (testId) => {
    const { data: test } = await supabase.from('tests').select('*').eq('id', testId).single();
    if (!test) return;

    // Check if already submitted
    const { data: existing } = await supabase.from('test_submissions').select('id').eq('test_id', testId).eq('student_id', currentUser.id).single();
    if (existing) { alert('You already took this test.'); return; }

    // Get questions for this test level
    const { data: questions } = await supabase.from('questions').select('*').eq('level_id', test.level_id);
    if (!questions?.length) { alert('No questions available for this test.'); return; }

    activeTest = test;
    testQuestions = questions;
    timeRemaining = test.time_limit_minutes * 60;

    $('student-dashboard').style.display = 'none';
    $('test-taking').style.display = 'block';
    $('test-taking-title').textContent = test.title;

    renderTestQuestions();
    startTimer();
};

function renderTestQuestions() {
    const container = $('test-questions-container');
    container.innerHTML = testQuestions.map((q, i) => `
        <div class="question-card" data-qid="${q.id}">
            <h3>Q${i + 1}. ${q.question_text}</h3>
            <div class="option" data-answer="A" onclick="selectAnswer(this, '${q.id}')">A. ${q.option_a}</div>
            <div class="option" data-answer="B" onclick="selectAnswer(this, '${q.id}')">B. ${q.option_b}</div>
            <div class="option" data-answer="C" onclick="selectAnswer(this, '${q.id}')">C. ${q.option_c}</div>
            <div class="option" data-answer="D" onclick="selectAnswer(this, '${q.id}')">D. ${q.option_d}</div>
        </div>
    `).join('');
}

window.selectAnswer = (el, questionId) => {
    const card = el.closest('.question-card');
    card.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    el.dataset.selected = 'true';
};

function startTimer() {
    updateTimerDisplay();
    testTimer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        if (timeRemaining <= 0) {
            clearInterval(testTimer);
            submitTest();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    $('timer-display').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

$('submit-test-btn').addEventListener('click', submitTest);

async function submitTest() {
    clearInterval(testTimer);

    // Collect answers
    const answers = testQuestions.map(q => {
        const card = document.querySelector(`.question-card[data-qid="${q.id}"]`);
        const selected = card?.querySelector('.option.selected');
        return {
            question_id: q.id,
            selected_answer: selected ? selected.dataset.answer : null,
            is_correct: selected ? selected.dataset.answer === q.correct_answer : false
        };
    });

    const score = answers.filter(a => a.is_correct).length;

    // Create submission
    const { data: submission } = await supabase.from('test_submissions').insert({
        test_id: activeTest.id,
        student_id: currentUser.id,
        score,
        total_questions: testQuestions.length
    }).select().single();

    // Insert answers
    if (submission) {
        const answerRows = answers.map(a => ({
            submission_id: submission.id,
            question_id: a.question_id,
            selected_answer: a.selected_answer,
            is_correct: a.is_correct
        }));
        await supabase.from('submission_answers').insert(answerRows);
    }

    // Show results
    $('test-taking').style.display = 'none';
    $('results-view').style.display = 'block';
    const pct = testQuestions.length > 0 ? Math.round((score / testQuestions.length) * 100) : 0;
    $('results-content').innerHTML = `
        <h2>${activeTest.title}</h2>
        <div class="score-big">${score} / ${testQuestions.length}</div>
        <p style="font-size:18px;">You scored <strong>${pct}%</strong></p>
        <p style="margin-top:20px;color:#666;">${pct >= 80 ? 'Excellent work!' : pct >= 60 ? 'Good job!' : pct >= 40 ? 'Keep practicing!' : 'Study more and try again!'}</p>
    `;
}

$('back-to-dashboard-btn').addEventListener('click', () => {
    $('results-view').style.display = 'none';
    $('student-dashboard').style.display = 'flex';
    loadStudentData();
});

// ============ INIT ============
supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (session) {
        currentUser = session.user;
        await loadProfile();
    }
});
