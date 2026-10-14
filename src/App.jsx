
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import "./App.css";

const API_URL = "http://localhoVITE_API_URL=https://student-performance-prediction-backend-14rd.onrender.com";
const AUTH_URL = "http://localhost:8080/api/auth";

const emptyForm = {
  name: "",
  attendance: "",
  studyHours: "",
  assignmentMarks: "",
  previousMarks: "",
};

function getPerformance(marks) {
  if (marks >= 80) return "Excellent";
  if (marks >= 60) return "Good";
  if (marks >= 40) return "Average";
  return "Needs Improvement";
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(`${AUTH_URL}/me`, {
          credentials: "include",
        });

        if (response.ok) {
          setUser(await response.json());
        }
      } catch {
        setAuthError("Cannot connect to the backend. Start Spring Boot on port 8080.");
      } finally {
        setAuthLoading(false);
      }
    }

    checkSession();
  }, []);

  useEffect(() => {
    if (user) loadStudents();
  }, [user]);

  async function loadStudents() {
    try {
      const response = await fetch(API_URL, {
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        setUser(null);
        setError("Your session has expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error("Could not load student records.");
      }

      setStudents(await response.json());
      setError("");
    } catch {
      setError("Unable to load students. Check that the backend is running.");
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    const email = authForm.email.trim().toLowerCase();

    if (!email || !authForm.password) {
      setAuthError("Please enter your email and password.");
      return;
    }

    if (authMode === "register") {
      if (!authForm.name.trim()) {
        setAuthError("Please enter your name.");
        return;
      }

      if (authForm.password.length < 8) {
        setAuthError("Password must contain at least 8 characters.");
        return;
      }
    }

    setAuthSubmitting(true);

    try {
      const response = await fetch(
        `${AUTH_URL}/${authMode === "register" ? "register" : "login"}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(authMode === "register" ? { name: authForm.name.trim() } : {}),
            email,
            password: authForm.password,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed.");
      }

      if (authMode === "register") {
        setAuthMessage("Account created successfully! You can now log in.");
        setAuthMode("login");
        setAuthForm((previous) => ({
          ...previous,
          name: "",
          password: "",
        }));
      } else {
        setUser(data);
        setAuthForm({ name: "", email: "", password: "" });
        setAuthError("");
      }
    } catch (err) {
      setAuthError(
        err.message || "Could not connect to the server. Check Spring Boot."
      );
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${AUTH_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Clear the local dashboard even if the server cannot be reached.
    }

    setUser(null);
    setStudents([]);
    setForm(emptyForm);
    setEditingId(null);
    setMessage("");
    setError("");
    setAuthMessage("You have been logged out.");
    setAuthMode("login");
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const name = form.name.trim();
    const attendance = Number(form.attendance);
    const studyHours = Number(form.studyHours);
    const assignmentMarks = Number(form.assignmentMarks);
    const previousMarks = Number(form.previousMarks);

    if (!name) {
      setError("Please enter the student's name.");
      return;
    }

    if (
      ![attendance, studyHours, assignmentMarks, previousMarks].every(
        Number.isFinite
      )
    ) {
      setError("Please enter valid numbers in all fields.");
      return;
    }

    if (
      attendance < 0 || attendance > 100 ||
      studyHours < 0 ||
      assignmentMarks < 0 || assignmentMarks > 100 ||
      previousMarks < 0 || previousMarks > 100
    ) {
      setError(
        "Attendance and marks must be between 0 and 100. Study hours cannot be negative."
      );
      return;
    }

    const payload = {
      name,
      attendance,
      studyHours,
      assignmentMarks,
      previousMarks,
    };

    setLoading(true);

    try {
      const isEditing = editingId !== null;
      const response = await fetch(
        isEditing ? `${API_URL}/${editingId}` : `${API_URL}/predict`,
        {
          method: isEditing ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.status === 401 || response.status === 403) {
        setUser(null);
        throw new Error("Your session has expired. Please log in again.");
      }

      if (!response.ok) {
        throw new Error(
          isEditing
            ? "Could not update the student."
            : "Could not predict student performance."
        );
      }

      const savedStudent = await response.json();
      await loadStudents();
      resetForm();

      setMessage(
        isEditing
          ? `${savedStudent.name}'s record was updated successfully.`
          : `Prediction completed for ${savedStudent.name}. Predicted marks: ${savedStudent.predictedMarks}`
      );
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(student) {
    setEditingId(student.id);
    setForm({
      name: student.name ?? "",
      attendance: String(student.attendance ?? ""),
      studyHours: String(student.studyHours ?? ""),
      assignmentMarks: String(student.assignmentMarks ?? ""),
      previousMarks: String(student.previousMarks ?? ""),
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete ${name}'s record?`)) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        setUser(null);
        throw new Error("Your session has expired. Please log in again.");
      }

      if (!response.ok) throw new Error("Could not delete the student.");

      setStudents((previous) =>
        previous.filter((student) => student.id !== id)
      );

      if (editingId === id) resetForm();
      setMessage(`${name}'s record was deleted.`);
    } catch (err) {
      setError(err.message || "Unable to delete the student.");
    }
  }

  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.name
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const performance = getPerformance(student.predictedMarks);
    return matchesSearch && (filter === "All" || performance === filter);
  });

  const averageMarks = students.length
    ? students.reduce((total, student) => total + Number(student.predictedMarks), 0) /
      students.length
    : 0;

  const highestMarks = students.length
    ? Math.max(...students.map((student) => Number(student.predictedMarks)))
    : 0;

  const chartData = [...students]
    .sort((a, b) => a.id - b.id)
    .slice(-8)
    .map((student) => ({
      name: student.name.length > 12
        ? `${student.name.slice(0, 12)}…`
        : student.name,
      marks: Number(student.predictedMarks),
    }));

  if (authLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>Student Analytics</h2>
          <p>Checking your login session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">SP</div>
          <p className="eyebrow">STUDENT ANALYTICS PLATFORM</p>
          <h1>{authMode === "login" ? "Welcome Back" : "Create Account"}</h1>
          <p className="auth-description">
            {authMode === "login"
              ? "Log in to access your performance dashboard."
              : "Register to start using the student performance predictor."}
          </p>

          {authError && <div className="message error-message">{authError}</div>}
          {authMessage && <div className="message success-message">{authMessage}</div>}

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {authMode === "register" && (
              <>
                <label htmlFor="auth-name">Full Name</label>
                <input
                  id="auth-name"
                  value={authForm.name}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, name: event.target.value })
                  }
                  placeholder="Enter your name"
                  required
                />
              </>
            )}

            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              value={authForm.email}
              onChange={(event) =>
                setAuthForm({ ...authForm, email: event.target.value })
              }
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={authForm.password}
              onChange={(event) =>
                setAuthForm({ ...authForm, password: event.target.value })
              }
              placeholder="At least 8 characters"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />

            <button className="primary-button auth-submit" disabled={authSubmitting}>
              {authSubmitting
                ? "Please wait..."
                : authMode === "login"
                  ? "Log In"
                  : "Create Account"}
            </button>
          </form>

          <p className="auth-switch">
            {authMode === "login" ? "Don't have an account?" : "Already have an account?"}
            {" "}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setAuthError("");
                setAuthMessage("");
              }}
            >
              {authMode === "login" ? "Register" : "Log In"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">SP</div>
          <div>
            <h2>Student Analytics</h2>
            <p>Performance Prediction Platform</p>
          </div>
        </div>

        <div className="header-user">
          <span className="welcome-user">Hi, {user.name}</span>
          <button className="logout-button" onClick={handleLogout} type="button">
            Log Out
          </button>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div>
            <p className="eyebrow">STUDENT ANALYTICS PLATFORM</p>
            <h1>Student Performance Predictor</h1>
            <p className="hero-description">
              Predict, track and understand student performance.
            </p>
          </div>
          <div className="hero-symbol">📊</div>
        </section>

        {message && <div className="message success-message">{message}</div>}
        {error && <div className="message error-message">{error}</div>}

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-heading">
              <span>Total Students</span><span className="stat-icon blue">👥</span>
            </div>
            <h2>{students.length}</h2>
            <p>Students evaluated</p>
          </article>
          <article className="stat-card">
            <div className="stat-heading">
              <span>Average Marks</span><span className="stat-icon purple">📊</span>
            </div>
            <h2>{averageMarks.toFixed(2)}</h2>
            <p>Predicted marks out of 100</p>
          </article>
          <article className="stat-card">
            <div className="stat-heading">
              <span>Highest Marks</span><span className="stat-icon orange">🏆</span>
            </div>
            <h2>{highestMarks.toFixed(2)}</h2>
            <p>Highest predicted score</p>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel form-panel">
            <div className="panel-heading">
              <div>
                <h2>{editingId !== null ? "Edit Student" : "Predict Performance"}</h2>
                <p>
                  {editingId !== null
                    ? "Update the student's details below."
                    : "Enter academic details to calculate predicted marks."}
                </p>
              </div>
              <span className="panel-icon">✏️</span>
            </div>

            <form onSubmit={handleSubmit}>
              <label htmlFor="name">Student Name</label>
              <input id="name" name="name" value={form.name} onChange={handleChange} placeholder="Enter student name" required />

              <div className="form-row">
                <div>
                  <label htmlFor="attendance">Attendance (%)</label>
                  <input id="attendance" name="attendance" type="number" min="0" max="100" step="0.01" value={form.attendance} onChange={handleChange} required />
                </div>
                <div>
                  <label htmlFor="studyHours">Study Hours/Day</label>
                  <input id="studyHours" name="studyHours" type="number" min="0" step="0.1" value={form.studyHours} onChange={handleChange} required />
                </div>
                <div>
                  <label htmlFor="assignmentMarks">Assignment Marks</label>
                  <input id="assignmentMarks" name="assignmentMarks" type="number" min="0" max="100" step="0.01" value={form.assignmentMarks} onChange={handleChange} required />
                </div>
                <div>
                  <label htmlFor="previousMarks">Previous Marks</label>
                  <input id="previousMarks" name="previousMarks" type="number" min="0" max="100" step="0.01" value={form.previousMarks} onChange={handleChange} required />
                </div>
              </div>

              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={loading}>
                  {loading ? "Please wait..." : editingId !== null ? "Save Changes" : "Predict Performance"}
                </button>
                {editingId !== null && (
                  <button className="secondary-button" type="button" onClick={resetForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </article>

          <article className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <h2>Performance Overview</h2>
                <p>Predicted marks of the latest students</p>
              </div>
              <span className="panel-icon">📈</span>
            </div>
            {chartData.length > 0 ? (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="marks" name="Predicted Marks" fill="#5b67e8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-chart">
                <span>📊</span><p>Add a student to see performance data.</p>
              </div>
            )}
          </article>
        </section>

        <section className="panel table-panel">
          <div className="panel-heading table-title">
            <div>
              <h2>Student Records</h2>
              <p>Search, filter, edit and manage student results.</p>
            </div>
            <span className="record-count">{filteredStudents.length} records</span>
          </div>

          <div className="table-controls">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by student name..."
              aria-label="Search students by name"
            />
            <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by performance">
              <option value="All">All Performance Levels</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Average">Average</option>
              <option value="Needs Improvement">Needs Improvement</option>
            </select>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Student Name</th><th>Attendance</th><th>Study Hours</th>
                  <th>Assignment</th><th>Previous</th><th>Predicted</th><th>Performance</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>{student.id}</td>
                    <td className="student-name">{student.name}</td>
                    <td>{student.attendance}%</td>
                    <td>{student.studyHours} hrs</td>
                    <td>{student.assignmentMarks}</td>
                    <td>{student.previousMarks}</td>
                    <td className="marks-cell">{Number(student.predictedMarks).toFixed(2)}</td>
                    <td>
                      <span className={`performance-badge ${getPerformance(student.predictedMarks).toLowerCase().replaceAll(" ", "-")}`}>
                        {getPerformance(student.predictedMarks)}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="edit-button" type="button" onClick={() => handleEdit(student)}>Edit</button>
                        <button className="delete-button" type="button" onClick={() => handleDelete(student.id, student.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="9" className="empty-table">
                      {students.length === 0 ? "No student records yet. Add a student above." : "No students match your search or filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="footer">
          Student Analytics Platform · Student Performance Predictor
        </footer>
      </main>
    </div>
  );
}

export default App;
