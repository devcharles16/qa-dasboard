import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar,
  PieChart, Pie, Cell
} from "recharts";

/**
 * QA Dashboard — React + Tailwind + Recharts
 * Features
 *  - Mock data for defects, test runs, pass rate
 *  - Filters: team, environment, date window
 *  - KPIs: Open Bugs, Sev1, Pass Rate, MTTR
 *  - Charts: Bugs over time (line), Bugs by severity (bar), Test pass/fail pie
 *  - Table: Recent defects
 *  - Accessible, responsive layout
 */

const TEAMS = ["Core", "Mobile", "Web", "Payments"]; 
const ENVS = ["Prod", "Staging", "UAT"];

// --- Utilities ---
function fmt(n) { return new Intl.NumberFormat().format(n); }
function pct(n) { return `${Math.round(n * 100)}%`; }
function daysAgo(num) { const d = new Date(); d.setDate(d.getDate() - num); return d; }
function iso(d) { return d.toISOString().slice(0,10); }
function range(n) { return Array.from({ length: n }, (_, i) => i); }

// Seeded-ish random for stable UI during a session
let seed = 42;
function rnd(min, max) { seed = (seed * 16807) % 2147483647; const r = seed / 2147483647; return Math.floor(r * (max - min + 1)) + min; }

// Generate mock daily series for the last N days
function genSeries(days = 30, { team, env }) {
  return range(days).map(i => {
    const date = daysAgo(days - 1 - i);
    const sev1 = Math.max(0, rnd(0, team === "Payments" ? 2 : 1) - (env === "UAT" ? 1 : 0));
    const sev2 = rnd(0, team === "Mobile" ? 5 : 3);
    const sev3 = rnd(1, 8);
    const opened = sev1 + sev2 + sev3;
    const closed = Math.max(0, opened - rnd(0, 3));
    const tests = 80 + rnd(0, 40);
    const passed = Math.max(0, Math.min(tests, Math.round(tests * (0.75 + rnd(0, 15)/100))));
    return { date: iso(date), opened, closed, sev1, sev2, sev3, tests, passed };
  });
}

function aggregate(series) {
  const totals = series.reduce((acc, d) => {
    acc.open += d.opened;
    acc.closed += d.closed;
    acc.sev1 += d.sev1;
    acc.sev2 += d.sev2;
    acc.sev3 += d.sev3;
    acc.tests += d.tests;
    acc.passed += d.passed;
    return acc;
  }, { open:0, closed:0, sev1:0, sev2:0, sev3:0, tests:0, passed:0 });
  const passRate = totals.tests ? totals.passed / totals.tests : 0;
  const mttrDays = Math.max(0.3, 1.2 + (totals.sev1 * 0.2) + (totals.sev2 * 0.05));
  return { totals, passRate, mttrDays };
}

export default function App() {
  const [team, setTeam] = useState(TEAMS[0]);
  const [env, setEnv] = useState(ENVS[1]); // default Staging
  const [days, setDays] = useState(30);

  useEffect(() => {
    document.body.style.background = "#f8fafc"; // slate-50
  }, []);

  const series = useMemo(() => genSeries(days, { team, env }), [team, env, days]);
  const { totals, passRate, mttrDays } = useMemo(() => aggregate(series), [series]);

  const openBugs = Math.max(0, totals.open - totals.closed);
  const sev1 = totals.sev1;

  const sevChart = [
    { name: "Sev 1", value: series.reduce((s,d)=>s+d.sev1,0) },
    { name: "Sev 2", value: series.reduce((s,d)=>s+d.sev2,0) },
    { name: "Sev 3", value: series.reduce((s,d)=>s+d.sev3,0) },
  ];
  const pieData = [
    { name: "Passed", value: series.reduce((s,d)=>s+d.passed,0) },
    { name: "Failed", value: series.reduce((s,d)=>s+(d.tests-d.passed),0) },
  ];
  const pieColors = ["#10b981", "#ef4444"]; // emerald-500, red-500

  // Fake recent defects table
  const recent = useMemo(() => {
    const rows = range(10).map(i => {
      const sev = i<2?"Sev 1": i<6?"Sev 2":"Sev 3";
      const id = `BUG-${1000 + rnd(0, 8999)}`;
      const title = [
        "Crash on checkout",
        "Login 2FA intermittently failing",
        "Layout shift on product page",
        "Slow API response /orders",
        "Missing aria-label on modal close",
        "iOS scroll freeze in cart",
        "Incorrect totals with discounts",
        "Search suggestions overlap header",
        "Image lazy-load not triggering",
        "Payment webhook retries exceed"
      ][i];
      const owner = ["Alex", "Priya", "Sam", "Jordan", "Lee"][i%5];
      const status = ["Open", "In Progress", "In Review"][i%3];
      const created = iso(daysAgo(rnd(0,7)));
      return { id, title, sev, owner, status, created };
    });
    return rows;
  }, [team, env]);

  return (
    <div className="min-h-screen text-slate-900">
      <Header />
      <main className="px-4 sm:px-6 py-8 mx-auto max-w-7xl">
        <Filters team={team} setTeam={setTeam} env={env} setEnv={setEnv} days={days} setDays={setDays} />

        {/* KPIs */}
        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Open Bugs" value={fmt(openBugs)} sub={`Closed ${fmt(totals.closed)} / ${fmt(totals.open)} opened`} />
          <KpiCard label="Sev 1" value={fmt(sev1)} sub="Last 30d total" accent="bg-red-100 text-red-700" />
          <KpiCard label="Pass Rate" value={pct(passRate)} sub={`${fmt(totals.passed)} / ${fmt(totals.tests)} tests`} />
          <KpiCard label="MTTR" value={`${mttrDays.toFixed(1)}d`} sub="Estimated mean time to resolve" />
        </section>

        {/* Charts */}
        <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
            <h3 className="font-semibold">Bugs Opened vs Closed</h3>
            <div className="h-64 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="opened" name="Opened" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="closed" name="Closed" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-semibold">Bugs by Severity</h3>
            <div className="h-64 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sevChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Count" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-semibold">Test Results</h3>
            <div className="h-64 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {pieData.map((e, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
            <h3 className="font-semibold">Recent Defects</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-600">
                  <tr>
                    <th className="py-2 pr-4">ID</th>
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Sev</th>
                    <th className="py-2 pr-4">Owner</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-800">{r.id}</td>
                      <td className="py-2 pr-4 text-slate-700">{r.title}</td>
                      <td className="py-2 pr-4">{r.sev}</td>
                      <td className="py-2 pr-4">{r.owner}</td>
                      <td className="py-2 pr-4">{r.status}</td>
                      <td className="py-2 pr-2">{r.created}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-8 w-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600" />
          <span>QA Dashboard</span>
        </div>
        <span className="text-sm text-slate-600 hidden sm:block">Quality at a glance</span>
      </div>
    </header>
  );
}

function Filters({ team, setTeam, env, setEnv, days, setDays }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Team</label>
          <select value={team} onChange={(e)=>setTeam(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {TEAMS.map(t=> <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Environment</label>
          <select value={env} onChange={(e)=>setEnv(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {ENVS.map(v=> <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Date Range</label>
          <select value={days} onChange={(e)=>setDays(Number(e.target.value))} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {[7,14,30,60,90].map(n=> <option key={n} value={n}>{n} days</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <a href="#" onClick={(e)=>{e.preventDefault(); window.location.reload();}} className="h-11 w-full inline-flex items-center justify-center rounded-2xl border border-slate-300 hover:bg-slate-50">Refresh data</a>
        </div>
      </div>
    </section>
  );
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${accent?accent:""}`}>
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-600">{sub}</div>}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-200 bg-white/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-sm text-slate-600 flex items-center justify-between">
        <span>© {new Date().getFullYear()} Devone Charles</span>
        <span className="hidden sm:inline">Mock data • Client-side only</span>
      </div>
    </footer>
  );
}
