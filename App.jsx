import { useState } from "react";

const SERVICES = [
  { id: "basic", name: "Basic Wash", duration: 60, price: 49 },
  { id: "full", name: "Full Detail", duration: 180, price: 149 },
  { id: "interior", name: "Interior Only", duration: 120, price: 99 },
  { id: "exterior", name: "Exterior Polish", duration: 150, price: 129 },
  { id: "ceramic", name: "Ceramic Coating", duration: 300, price: 399 },
];

const HOURS = ["8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM"];

const initialAppointments = [
  { id: 1, name: "Marcus Webb", phone: "555-210-3847", email: "m.webb@email.com", service: "full", date: "2026-03-05", time: "9:00 AM", vehicle: "2021 BMW 3 Series (Black)", status: "confirmed", notes: "Pet hair removal needed" },
  { id: 2, name: "Priya Nair", phone: "555-482-9021", email: "priya.n@email.com", service: "ceramic", date: "2026-03-05", time: "10:00 AM", vehicle: "2023 Tesla Model Y (White)", status: "confirmed", notes: "" },
  { id: 3, name: "Devon Castillo", phone: "555-773-1564", email: "dcastillo@email.com", service: "interior", date: "2026-03-06", time: "1:00 PM", vehicle: "2019 Ford F-150 (Silver)", status: "pending", notes: "Kids' car seats - needs deep clean" },
  { id: 4, name: "Samantha Okonkwo", phone: "555-390-6182", email: "s.okonkwo@email.com", service: "basic", date: "2026-03-07", time: "11:00 AM", vehicle: "2020 Honda Accord (Red)", status: "confirmed", notes: "" },
];

const STATUS_STYLES = {
  confirmed: { bg: "#1a3a2a", text: "#4ade80", dot: "#22c55e" },
  pending:   { bg: "#3a2a0a", text: "#fbbf24", dot: "#f59e0b" },
  cancelled: { bg: "#3a1a1a", text: "#f87171", dot: "#ef4444" },
  completed: { bg: "#1a2a3a", text: "#60a5fa", dot: "#3b82f6" },
};

function callClaude(messages, systemPrompt) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  })
    .then(r => r.json())
    .then(d => d.content?.[0]?.text || "Unable to generate response.");
}

export default function App() {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [view, setView] = useState("dashboard");
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [newAppt, setNewAppt] = useState({ name:"", phone:"", email:"", service:"basic", date:"", time:"8:00 AM", vehicle:"", notes:"" });
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const grouped = appointments.reduce((acc, a) => {
    if (filterDate && a.date !== filterDate) return acc;
    if (!acc[a.date]) acc[a.date] = [];
    acc[a.date].push(a);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter(a => a.status === "confirmed").length,
    pending: appointments.filter(a => a.status === "pending").length,
    revenue: appointments.filter(a => a.status !== "cancelled").reduce((s, a) => s + (SERVICES.find(sv => sv.id === a.service)?.price || 0), 0),
  };

  const getService = id => SERVICES.find(s => s.id === id);

  const updateStatus = (id, status) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    if (selectedAppt?.id === id) setSelectedAppt(prev => ({ ...prev, status }));
    showToast(`Appointment ${status}`);
  };

  const addAppointment = () => {
    if (!newAppt.name || !newAppt.date || !newAppt.phone) { showToast("Please fill required fields", "error"); return; }
    const id = Date.now();
    setAppointments(prev => [...prev, { ...newAppt, id, status: "pending" }]);
    setShowNewForm(false);
    setNewAppt({ name:"", phone:"", email:"", service:"basic", date:"", time:"8:00 AM", vehicle:"", notes:"" });
    showToast("Appointment added!");
  };

  const generateMessage = async (type) => {
    if (!selectedAppt) return;
    setAiLoading(true);
    setAiOutput("");
    const svc = getService(selectedAppt.service);
    const system = `You are a friendly assistant for "Shine Pro Detailing", a premium car detailing business. 
Write professional, warm, concise messages for customers. Keep them brief (under 100 words). Do not use markdown.`;
    const prompts = {
      confirm: `Write a text/SMS confirmation message for: Customer: ${selectedAppt.name}, Service: ${svc?.name}, Date: ${selectedAppt.date}, Time: ${selectedAppt.time}, Vehicle: ${selectedAppt.vehicle || "their vehicle"}, Price: $${svc?.price}. Include that they can reply to cancel or reschedule.`,
      reminder: `Write a friendly reminder text/SMS for tomorrow's appointment: Customer: ${selectedAppt.name}, Service: ${svc?.name}, Time: ${selectedAppt.time}. Remind them to have the car accessible and pet/personal items removed if applicable.`,
      cancel: `Write a cancellation acknowledgment text/SMS for: Customer: ${selectedAppt.name}. Express understanding, offer to reschedule, and thank them for being a customer of Shine Pro Detailing.`,
      followup: `Write a post-service follow-up text/SMS for: Customer: ${selectedAppt.name}, Service: ${svc?.name}. Thank them, invite them to leave a Google review, and offer a loyalty discount for next visit.`,
    };
    const text = await callClaude([{ role: "user", content: prompts[type] }], system);
    setAiOutput(text);
    setAiLoading(false);
  };

  const handleAiChat = async () => {
    if (!aiMessage.trim()) return;
    setAiLoading(true);
    setAiOutput("");
    const system = `You are a scheduling assistant for "Shine Pro Detailing". 
Current appointments: ${JSON.stringify(appointments.map(a => ({ name: a.name, service: a.service, date: a.date, time: a.time, status: a.status })))}.
Services: ${JSON.stringify(SERVICES)}.
Help answer questions about scheduling, availability, and customer management. Be concise and practical.`;
    const text = await callClaude([{ role: "user", content: aiMessage }], system);
    setAiOutput(text);
    setAiMessage("");
    setAiLoading(false);
  };

  const fmtDate = d => {
    const [y, m, day] = d.split("-");
    return new Date(y, m - 1, day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: "#0a0a0a", minHeight: "100vh", color: "#e8e0d0" }}>
      {toast && (
        <div style={{ position:"fixed", top:20, right:20, zIndex:9999, background: toast.type==="error"?"#7f1d1d":"#14532d", color:"#fff", padding:"12px 20px", borderRadius:8, fontSize:14, boxShadow:"0 4px 20px rgba(0,0,0,0.5)" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ background:"#111", borderBottom:"1px solid #222", padding:"0 32px", display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, background:"linear-gradient(135deg, #c9a84c, #8b6914)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>✦</div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, letterSpacing:"0.05em", color:"#c9a84c" }}>SHINE PRO</div>
            <div style={{ fontSize:10, letterSpacing:"0.15em", color:"#666", textTransform:"uppercase" }}>Detailing Management</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:4 }}>
          {["dashboard","ai"].map(v => (
            <button key={v} onClick={() => { setView(v); setAiOutput(""); }} style={{ padding:"8px 18px", borderRadius:6, border:"none", cursor:"pointer", fontSize:13, fontFamily:"inherit", background: view===v ? "#c9a84c" : "transparent", color: view===v ? "#0a0a0a" : "#888", fontWeight: view===v ? 700 : 400 }}>
              {v === "dashboard" ? "📋 Schedule" : "✦ AI Assistant"}
            </button>
          ))}
          <button onClick={() => setShowNewForm(true)} style={{ marginLeft:12, padding:"8px 18px", borderRadius:6, border:"1px solid #c9a84c", cursor:"pointer", fontSize:13, fontFamily:"inherit", background:"transparent", color:"#c9a84c", fontWeight:600 }}>
            + New Booking
          </button>
        </div>
      </div>

      <div style={{ display:"flex", height:"calc(100vh - 64px)" }}>
        <div style={{ flex:1, overflowY:"auto", padding:28 }}>
          {view === "dashboard" && (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:28 }}>
                {[
                  { label:"Total Bookings", value:stats.total, icon:"📅" },
                  { label:"Confirmed", value:stats.confirmed, icon:"✓" },
                  { label:"Pending", value:stats.pending, icon:"⏳" },
                  { label:"Est. Revenue", value:`$${stats.revenue}`, icon:"$" },
                ].map(s => (
                  <div key={s.label} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"18px 20px" }}>
                    <div style={{ fontSize:11, color:"#555", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>{s.icon} {s.label}</div>
                    <div style={{ fontSize:28, fontWeight:700, color:"#c9a84c" }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                <span style={{ fontSize:12, color:"#555", letterSpacing:"0.1em" }}>FILTER BY DATE</span>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ background:"#111", border:"1px solid #222", borderRadius:6, color:"#e8e0d0", padding:"6px 10px", fontSize:13, fontFamily:"inherit" }} />
                {filterDate && <button onClick={() => setFilterDate("")} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:12 }}>Clear ✕</button>}
              </div>

              {sortedDates.length === 0 && <div style={{ color:"#444", textAlign:"center", paddingTop:60 }}>No appointments found.</div>}
              {sortedDates.map(date => (
                <div key={date} style={{ marginBottom:28 }}>
                  <div style={{ fontSize:11, letterSpacing:"0.15em", color:"#c9a84c", textTransform:"uppercase", marginBottom:12, paddingBottom:8, borderBottom:"1px solid #1a1a1a" }}>
                    {fmtDate(date)}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {grouped[date].sort((a,b) => HOURS.indexOf(a.time) - HOURS.indexOf(b.time)).map(appt => {
                      const svc = getService(appt.service);
                      const st = STATUS_STYLES[appt.status] || STATUS_STYLES.pending;
                      const isSelected = selectedAppt?.id === appt.id;
                      return (
                        <div key={appt.id} onClick={() => { setSelectedAppt(isSelected ? null : appt); setAiOutput(""); }} style={{ background: isSelected ? "#161610" : "#111", border:`1px solid ${isSelected ? "#c9a84c44" : "#1a1a1a"}`, borderRadius:10, padding:"14px 18px", cursor:"pointer", display:"flex", alignItems:"center", gap:16 }}>
                          <div style={{ width:64, textAlign:"center" }}>
                            <div style={{ fontSize:13, fontWeight:700, color:"#e8e0d0" }}>{appt.time}</div>
                            <div style={{ fontSize:10, color:"#555" }}>{svc?.duration}min</div>
                          </div>
                          <div style={{ width:1, height:36, background:"#1e1e1e" }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:14, fontWeight:600, color:"#e8e0d0" }}>{appt.name}</div>
                            <div style={{ fontSize:12, color:"#666", marginTop:2 }}>{appt.vehicle || "Vehicle not specified"}</div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:13, color:"#c9a84c", fontWeight:600 }}>{svc?.name}</div>
                            <div style={{ fontSize:12, color:"#555" }}>${svc?.price}</div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, background:st.bg, borderRadius:20, padding:"4px 10px" }}>
                            <div style={{ width:6, height:6, borderRadius:"50%", background:st.dot }} />
                            <span style={{ fontSize:11, color:st.text, textTransform:"capitalize", letterSpacing:"0.05em" }}>{appt.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {view === "ai" && (
            <div style={{ maxWidth:680, margin:"0 auto" }}>
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:20, fontWeight:700, color:"#c9a84c", marginBottom:4 }}>AI Scheduling Assistant</div>
                <div style={{ fontSize:13, color:"#555" }}>Ask anything about your schedule, availability, or customer management.</div>
              </div>
              <div style={{ display:"flex", gap:10, marginBottom:20 }}>
                <input value={aiMessage} onChange={e => setAiMessage(e.target.value)} onKeyDown={e => e.key==="Enter" && handleAiChat()} placeholder="e.g. What's my busiest day? Any conflicts? When am I free on March 7?" style={{ flex:1, background:"#111", border:"1px solid #222", borderRadius:8, color:"#e8e0d0", padding:"12px 16px", fontSize:14, fontFamily:"inherit", outline:"none" }} />
                <button onClick={handleAiChat} disabled={aiLoading} style={{ padding:"12px 20px", background:"#c9a84c", border:"none", borderRadius:8, color:"#0a0a0a", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  {aiLoading ? "..." : "Ask"}
                </button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
                {["What's my schedule for March 6?","Any back-to-back appointments?","Which service makes the most revenue?","How many pending bookings do I have?"].map(q => (
                  <button key={q} onClick={() => setAiMessage(q)} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:8, color:"#888", padding:"10px 14px", fontSize:12, cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>{q}</button>
                ))}
              </div>
              {aiLoading && <div style={{ fontSize:13, color:"#555", textAlign:"center", padding:24 }}>Thinking…</div>}
              {aiOutput && !aiLoading && (
                <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:20 }}>
                  <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#c9a84c", marginBottom:10 }}>✦ ASSISTANT</div>
                  <div style={{ fontSize:14, color:"#e8e0d0", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{aiOutput}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedAppt && (
          <div style={{ width:320, borderLeft:"1px solid #1a1a1a", background:"#0d0d0d", padding:24, overflowY:"auto", flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontSize:13, letterSpacing:"0.1em", color:"#c9a84c" }}>APPOINTMENT</div>
              <button onClick={() => { setSelectedAppt(null); setAiOutput(""); }} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:18 }}>✕</button>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>{selectedAppt.name}</div>
              <div style={{ fontSize:13, color:"#666" }}>{selectedAppt.phone}</div>
              <div style={{ fontSize:13, color:"#666" }}>{selectedAppt.email}</div>
            </div>

            <div style={{ background:"#111", borderRadius:10, padding:14, marginBottom:16, display:"grid", gap:8 }}>
              {[
                ["Service", getService(selectedAppt.service)?.name],
                ["Date", fmtDate(selectedAppt.date)],
                ["Time", selectedAppt.time],
                ["Duration", `${getService(selectedAppt.service)?.duration} min`],
                ["Price", `$${getService(selectedAppt.service)?.price}`],
                ["Vehicle", selectedAppt.vehicle || "—"],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                  <span style={{ color:"#555" }}>{k}</span>
                  <span style={{ color:"#e8e0d0", textAlign:"right", maxWidth:160 }}>{v}</span>
                </div>
              ))}
            </div>

            {selectedAppt.notes && (
              <div style={{ background:"#111", borderRadius:10, padding:14, marginBottom:16, fontSize:13, color:"#888", fontStyle:"italic" }}>
                "{selectedAppt.notes}"
              </div>
            )}

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:"#444", letterSpacing:"0.1em", marginBottom:8 }}>UPDATE STATUS</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {["confirmed","pending","completed","cancelled"].map(s => (
                  <button key={s} onClick={() => updateStatus(selectedAppt.id, s)} style={{ padding:"6px 12px", borderRadius:6, border:`1px solid ${selectedAppt.status===s?"#c9a84c":"#222"}`, background: selectedAppt.status===s?"#c9a84c22":"transparent", color: selectedAppt.status===s?"#c9a84c":"#555", fontSize:11, cursor:"pointer", fontFamily:"inherit", textTransform:"capitalize" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize:11, color:"#444", letterSpacing:"0.1em", marginBottom:8 }}>GENERATE MESSAGE</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:12 }}>
                {[["confirm","✓ Confirm"],["reminder","⏰ Reminder"],["cancel","✕ Cancel"],["followup","★ Follow-up"]].map(([type, label]) => (
                  <button key={type} onClick={() => generateMessage(type)} style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #1e1e1e", background:"#111", color:"#aaa", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                    {label}
                  </button>
                ))}
              </div>
              {aiLoading && <div style={{ fontSize:13, color:"#555", textAlign:"center", padding:12 }}>Generating…</div>}
              {aiOutput && !aiLoading && (
                <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:14 }}>
                  <div style={{ fontSize:10, color:"#c9a84c", letterSpacing:"0.1em", marginBottom:8 }}>✦ READY TO SEND</div>
                  <div style={{ fontSize:13, color:"#e8e0d0", lineHeight:1.7, whiteSpace:"pre-wrap", marginBottom:12 }}>{aiOutput}</div>
                  <button onClick={() => { navigator.clipboard.writeText(aiOutput); showToast("Copied!"); }} style={{ width:"100%", padding:"8px", borderRadius:6, border:"1px solid #c9a84c44", background:"transparent", color:"#c9a84c", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                    Copy Message
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showNewForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
          <div style={{ background:"#111", border:"1px solid #222", borderRadius:16, padding:32, width:480, maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#c9a84c", marginBottom:20 }}>New Booking</div>
            <div style={{ display:"grid", gap:14 }}>
              {[["Customer Name *", "name", "text"],["Phone *", "phone", "tel"],["Email", "email", "email"],["Vehicle (year, make, model, color)", "vehicle", "text"]].map(([label, field, type]) => (
                <div key={field}>
                  <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>{label}</div>
                  <input type={type} value={newAppt[field]} onChange={e => setNewAppt(p => ({...p, [field]: e.target.value}))} style={{ width:"100%", background:"#0d0d0d", border:"1px solid #222", borderRadius:8, color:"#e8e0d0", padding:"10px 12px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none" }} />
                </div>
              ))}
              <div>
                <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>Service</div>
                <select value={newAppt.service} onChange={e => setNewAppt(p => ({...p, service:e.target.value}))} style={{ width:"100%", background:"#0d0d0d", border:"1px solid #222", borderRadius:8, color:"#e8e0d0", padding:"10px 12px", fontSize:14, fontFamily:"inherit" }}>
                  {SERVICES.map(s => <option key={s.id} value={s.id}>{s.name} — ${s.price} ({s.duration}min)</option>)}
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>Date *</div>
                  <input type="date" value={newAppt.date} onChange={e => setNewAppt(p => ({...p, date:e.target.value}))} style={{ width:"100%", background:"#0d0d0d", border:"1px solid #222", borderRadius:8, color:"#e8e0d0", padding:"10px 12px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>Time</div>
                  <select value={newAppt.time} onChange={e => setNewAppt(p => ({...p, time:e.target.value}))} style={{ width:"100%", background:"#0d0d0d", border:"1px solid #222", borderRadius:8, color:"#e8e0d0", padding:"10px 12px", fontSize:14, fontFamily:"inherit" }}>
                    {HOURS.map(h => <option key={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>Notes</div>
                <textarea value={newAppt.notes} onChange={e => setNewAppt(p => ({...p, notes:e.target.value}))} rows={2} style={{ width:"100%", background:"#0d0d0d", border:"1px solid #222", borderRadius:8, color:"#e8e0d0", padding:"10px 12px", fontSize:14, fontFamily:"inherit", resize:"vertical", boxSizing:"border-box" }} />
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={() => setShowNewForm(false)} style={{ flex:1, padding:"10px", borderRadius:8, border:"1px solid #222", background:"transparent", color:"#666", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
              <button onClick={addAppointment} style={{ flex:2, padding:"10px", borderRadius:8, border:"none", background:"#c9a84c", color:"#0a0a0a", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Add Booking</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
