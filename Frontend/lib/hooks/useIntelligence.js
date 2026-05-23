import { useState, useCallback, useEffect, useRef } from "react";
import { INCIDENT_API_URL_HOST } from "../constants";

const API = INCIDENT_API_URL_HOST;

export function useIntelligence() {
  const [intel, setIntel]             = useState(null);
  const [incidents, setIncidents]     = useState([]);
  const [dataSources, setDataSources] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [running, setRunning]         = useState(false);
  const [timeline, setTimeline]       = useState([]);

  const addTimeline = useCallback((text, level = "info") => {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    setTimeline(prev => [{ id: Date.now(), t, text, level }, ...prev].slice(0, 30));
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [intR, incR, srcR] = await Promise.all([
        fetch(`${API}/intelligence`).then(r => r.json()).catch(() => null),
        fetch(`${API}/incidents`).then(r => r.json()).catch(() => ({ incidents: [] })),
        fetch(`${API}/data/source-status`).then(r => r.json()).catch(() => ({ sources: [] })),
      ]);
      if (intR) setIntel(intR);
      setIncidents(incR?.incidents || []);
      setDataSources(srcR?.sources || []);
    } catch (e) {
      console.error("fetchAll error:", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
      addTimeline("System connected — monitoring city feeds", "info");
    })();
  }, [fetchAll]);

  const refreshRef = useRef(null);
  useEffect(() => {
    refreshRef.current = setInterval(fetchAll, 60_000);
    return () => clearInterval(refreshRef.current);
  }, [fetchAll]);

  const runPipeline = useCallback(async (mode = "demo") => {
    setRunning(true);
    addTimeline(`Running ${mode} pipeline...`, "info");
    try {
      await fetch(`${API}/pipeline/run?source_mode=${mode}`, { method: "POST" });
      addTimeline("Analysis complete", "safe");
      await fetchAll();
    } catch (e) {
      addTimeline("Pipeline error — check connection", "critical");
    } finally {
      setRunning(false);
    }
  }, [fetchAll, addTimeline]);

  const loadDemo = useCallback(async (scenario = "all") => {
    setRunning(true);
    addTimeline(`Loading demo: ${scenario}...`, "info");
    try {
      await fetch(`${API}/demo/scenario/${scenario}`, { method: "POST" });
      await fetchAll();
      addTimeline("Demo loaded", "safe");
    } catch (e) {
      addTimeline("Demo load failed", "critical");
    } finally {
      setRunning(false);
    }
  }, [fetchAll, addTimeline]);

  const triggerDispatch = useCallback(async () => {
    addTimeline("Encrypting dispatch messages...", "info");
    try {
      await fetch(`${API}/dispatch`, { method: "POST" });
      addTimeline("Secure dispatches sent to responders", "safe");
      await fetchAll();
    } catch (e) {
      addTimeline("Dispatch error", "critical");
    }
  }, [fetchAll, addTimeline]);

  const submitReport = useCallback(async ({ text, lat, lng, imageUri }) => {
    const form = new FormData();
    form.append("text", text);
    if (lat != null) form.append("latitude", String(lat));
    if (lng != null) form.append("longitude", String(lng));
    if (imageUri) {
      const ext = imageUri.split(".").pop() || "jpg";
      const type = `image/${ext === "jpg" ? "jpeg" : ext}`;
      form.append("image", { uri: imageUri, name: `photo.${ext}`, type });
    }
    const res = await fetch(`${API}/report`, { method: "POST", body: form });
    const r = await res.json();
    addTimeline("Emergency report submitted", "critical");
    await fetchAll();
    return r;
  }, [fetchAll, addTimeline]);

  const cs        = intel?.city_status            || {};
  const brief     = intel?.ai_command_brief       || {};
  const riskAreas = intel?.risk_areas             || [];
  const respPlan  = intel?.response_plan          || [];
  const secComm   = intel?.secure_communication   || {};
  const alerts    = intel?.predictive_alerts      || [];
  const tech      = intel?.technical_layer        || {};

  return {
    intel, incidents, dataSources, loading, running, timeline,
    cs, brief, riskAreas, respPlan, secComm, alerts, tech,
    fetchAll, runPipeline, loadDemo, triggerDispatch, submitReport, addTimeline,
  };
}
