import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Palette, Save, Settings as SettingsIcon, User, ShieldCheck } from "lucide-react";

type AdminInfo = { id?: number; name?: string; email?: string; phone?: string; role?: string; token?: string };
type Prefs = { email: boolean; assignments: boolean; attendance: boolean; exams: boolean; announcements: boolean; theme: "Light" | "Dark"; compactMode: boolean };
const defaults: Prefs = { email: true, assignments: true, attendance: true, exams: true, announcements: true, theme: "Light", compactMode: false };

export default function Settings() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"profile" | "notifications" | "appearance" | "security">("profile");
  const [user, setUser] = useState<AdminInfo | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(defaults);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let session: AdminInfo;
    try { session = JSON.parse(localStorage.getItem("user") || "null"); }
    catch { navigate("/login", { replace: true }); return; }
    if (!session || session.role !== "admin") { navigate("/login", { replace: true }); return; }
    setUser(session);
    try {
      const saved = JSON.parse(localStorage.getItem(`campus95_admin_preferences_${session.id ?? session.email}`) || "null");
      if (saved && typeof saved === "object") {
        setPrefs({
          email: typeof saved.email === "boolean" ? saved.email : defaults.email,
          assignments: typeof saved.assignments === "boolean" ? saved.assignments : defaults.assignments,
          attendance: typeof saved.attendance === "boolean" ? saved.attendance : defaults.attendance,
          exams: typeof saved.exams === "boolean" ? saved.exams : defaults.exams,
          announcements: typeof saved.announcements === "boolean" ? saved.announcements : defaults.announcements,
          theme: saved.theme === "Dark" ? "Dark" : "Light",
          compactMode: typeof saved.compactMode === "boolean" ? saved.compactMode : defaults.compactMode,
        });
      }
    } catch { /* Invalid browser preferences are ignored. */ }
  }, [navigate]);

  const save = () => {
    if (!user) return;
    try {
      localStorage.setItem(`campus95_admin_preferences_${user.id ?? user.email}`, JSON.stringify(prefs));
      setMessage("Preferences saved on this browser."); setSaveError(false);
    } catch { setMessage("Browser storage is unavailable. Preferences were not saved."); setSaveError(true); }
  };
  const setBool = (key: "email" | "assignments" | "attendance" | "exams" | "announcements" | "compactMode", value: boolean) => {
    setPrefs(p => ({ ...p, [key]: value })); setMessage("");
  };
  const tabs: { id: typeof tab; label: string; Icon: typeof User }[] = [
    { id: "profile", label: "Profile", Icon: User },
    { id: "notifications", label: "Notifications", Icon: Bell },
    { id: "appearance", label: "Appearance", Icon: Palette },
    { id: "security", label: "Security", Icon: ShieldCheck },
  ];
  const name = user?.name || "Admin";
  const initials = name.trim().split(/\s+/).slice(0,2).map(s => s[0]?.toUpperCase()).join("") || "A";
  const dark = prefs.theme === "Dark";

  return (
    <div className={`min-h-screen ${dark ? "bg-slate-900" : "bg-slate-100"}`}>
      <header className="bg-white border-b px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link to="/admin-dashboard" className="p-2 rounded-lg hover:bg-slate-100" aria-label="Back to dashboard"><ArrowLeft size={20}/></Link>
          <div className="bg-blue-100 text-blue-600 p-2 rounded-lg"><SettingsIcon size={22}/></div>
          <div><h1 className="text-2xl font-bold text-slate-800">Settings</h1><p className="text-sm text-slate-500">Manage your administrator preferences</p></div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-6">
        {message && <div role="status" className={`mb-6 rounded-lg px-4 py-3 ${saveError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{message}</div>}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="bg-white rounded-xl shadow-sm p-4 h-fit">
            <div className="px-3 mb-5"><div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold mb-3">{initials}</div><h2 className="font-bold text-slate-800">{name}</h2><p className="text-sm text-slate-500">Administrator</p></div>
            {tabs.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => { setTab(id); setMessage(""); }} className={`w-full flex gap-3 items-center px-4 py-3 rounded-lg text-left ${tab === id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><Icon size={19}/>{label}</button>)}
          </aside>
          <section className={`lg:col-span-3 bg-white rounded-xl shadow-sm ${prefs.compactMode ? "p-4" : "p-6"}`}>
            {tab === "profile" && <>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Administrator Profile</h2>
              <p className="text-sm text-slate-500 mb-6">Account information from your current login session. Editing is disabled until a secure profile update API is implemented.</p>
              <div className="grid md:grid-cols-2 gap-5">
                <label className="block text-sm font-medium text-slate-700">Full Name<input readOnly value={user?.name || ""} className="block w-full mt-2 border rounded-lg px-4 py-3 bg-slate-50" /></label>
                <label className="block text-sm font-medium text-slate-700">Email Address<input readOnly value={user?.email || ""} className="block w-full mt-2 border rounded-lg px-4 py-3 bg-slate-50" /></label>
                <label className="block text-sm font-medium text-slate-700">Phone Number<input readOnly value={user?.phone || "Not available in session"} className="block w-full mt-2 border rounded-lg px-4 py-3 bg-slate-50" /></label>
                <label className="block text-sm font-medium text-slate-700">Role<input readOnly value="Administrator" className="block w-full mt-2 border rounded-lg px-4 py-3 bg-slate-50" /></label>
              </div>
            </>}
            {tab === "notifications" && <>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Notification Preferences</h2>
              <p className="text-sm text-slate-500 mb-5">These switches store your preferences locally; they do not yet control backend email or push delivery.</p>
              <div className="space-y-3">{([
                ["email", "Email Notifications"], ["assignments", "Assignment Notifications"],
                ["attendance", "Attendance Notifications"], ["exams", "Exam Notifications"],
                ["announcements", "Announcements"],
              ] as const).map(([key, label]) => <label key={key} className="flex justify-between items-center border p-4 rounded-lg gap-4"><span className="text-slate-700 font-medium">{label}</span><input type="checkbox" className="w-5 h-5" checked={prefs[key]} onChange={e => setBool(key, e.target.checked)}/></label>)}</div>
              <button type="button" onClick={save} className="mt-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-3"><Save size={18}/>Save Notifications</button>
            </>}
            {tab === "appearance" && <>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Appearance</h2>
              <p className="text-sm text-slate-500 mb-5">Settings-page theme and layout preferences. Global theme requires dashboard-wide integration.</p>
              <label className="block text-sm font-medium text-slate-700">Theme<select className="block w-full border rounded-lg px-4 py-3 mt-2" value={prefs.theme} onChange={e => { setPrefs(p => ({ ...p, theme: e.target.value as Prefs["theme"] })); setMessage(""); }}><option value="Light">Light</option><option value="Dark">Dark</option></select></label>
              <label className="flex justify-between items-center gap-4 mt-5 border p-4 rounded-lg"><span className="font-medium text-slate-700">Compact settings layout</span><input type="checkbox" checked={prefs.compactMode} onChange={e => setBool("compactMode", e.target.checked)}/></label>
              <button type="button" onClick={save} className="mt-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-3"><Save size={18}/>Save Appearance</button>
            </>}
            {tab === "security" && <>
              <div className="flex items-center gap-3 mb-4"><ShieldCheck className="text-blue-600"/><h2 className="text-xl font-bold text-slate-800">Account Security</h2></div>
              <p className="text-slate-600">This page does not change your password. The previous form only displayed a success message and did not call the backend.</p>
              <p className="text-sm text-slate-500 mt-3">Use the existing verified password reset process on the login page, if available. Do not enter your current password in an unconnected form.</p>
            </>}
          </section>
        </div>
      </main>
    </div>
  );
}
