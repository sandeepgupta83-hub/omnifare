import { useState, useEffect, useRef, useCallback } from "react";

const GOOGLE_KEY = "AIzaSyAc8uGXT6HwMYNtKcJwEV3juLIB0FAm-Uc";
const UBER_CLIENT_ID = "JSW8nReh5R3Ebi5ZELyvMNFiHC4GuuqR";

// ── Load Google Maps script once ────────────────────────────────────────────
function useGoogleMaps() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.google) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places`;
    s.async = true;
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  return ready;
}

// ── Haversine ───────────────────────────────────────────────────────────────
function haversineKm(a, b) {
  const R = 6371, toR = d => d * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

// ── Fare engine ─────────────────────────────────────────────────────────────
const RATES = {
  Bike:  { base: 25, perKm: 7,  min: 30  },
  Auto:  { base: 35, perKm: 12, min: 50  },
  Mini:  { base: 50, perKm: 14, min: 80  },
  Sedan: { base: 70, perKm: 18, min: 120 },
  Prime: { base: 90, perKm: 22, min: 150 },
};
const VEHICLES = ["Bike","Auto","Mini","Sedan","Prime"];
const AGGS = [
  { id:"uber",   name:"Uber",        logo:"U", bg:"#000",    fg:"#fff", mult:1.05, etaBase:5 },
  { id:"ola",    name:"Ola",         logo:"O", bg:"#1a9e4a", fg:"#fff", mult:0.97, etaBase:4 },
  { id:"rapido", name:"Rapido",      logo:"R", bg:"#e6b800", fg:"#111", mult:0.88, etaBase:6 },
  { id:"namma",  name:"Namma Yatri", logo:"N", bg:"#5a52e0", fg:"#fff", mult:0.92, etaBase:8 },
];

function calcFares(km, vehicle) {
  const r = RATES[vehicle];
  const h = new Date().getHours();
  const surgeTime = (h>=8&&h<=10)||(h>=18&&h<=21);
  return AGGS.map(a => {
    const surge = surgeTime && Math.random()>0.55 ? +(1.2+Math.random()*0.5).toFixed(1) : null;
    const raw = (r.base + km*r.perKm)*a.mult*(surge||1);
    const fare = Math.max(r.min, Math.round(raw/5)*5);
    const eta  = a.etaBase + Math.floor(Math.random()*7);
    const available = !(a.id==="namma"&&(vehicle==="Prime"||vehicle==="Sedan")) && Math.random()>0.08;
    return { ...a, fare, eta, surge, available, km:+km.toFixed(1) };
  });
}

function deepLink(id, pu, dr) {
  const p=encodeURIComponent(pu), d=encodeURIComponent(dr);
  return {
    uber:   `https://m.uber.com/ul/?client_id=${UBER_CLIENT_ID}&action=setPickup&pickup[formatted_address]=${p}&dropoff[formatted_address]=${d}`,
    ola:    `https://book.olacabs.com/?pickup_name=${p}&drop_name=${d}`,
    rapido: `https://rapido.bike/?src=${p}&dst=${d}`,
    namma:  `https://nammayatri.in/`,
  }[id]||"#";
}

// ── Places Autocomplete Input ────────────────────────────────────────────────
function PlacesInput({ placeholder, value, onSelect, icon, mapsReady }) {
  const [query, setQuery] = useState(value||"");
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const svcRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (mapsReady && !svcRef.current) {
      svcRef.current = new window.google.maps.places.AutocompleteService();
    }
  }, [mapsReady]);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    if (!v || !svcRef.current) { setSuggestions([]); return; }
    svcRef.current.getPlacePredictions(
      { input: v, componentRestrictions: { country: "in" }, types: ["geocode","establishment"] },
      (preds, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && preds) {
          setSuggestions(preds.slice(0,5));
          setShowDrop(true);
        } else setSuggestions([]);
      }
    );
  };

  const handleSelect = (pred) => {
    setQuery(pred.description);
    setSuggestions([]);
    setShowDrop(false);
    // Geocode to get lat/lng
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ placeId: pred.place_id }, (results, status) => {
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        onSelect({ name: pred.description, lat: loc.lat(), lng: loc.lng() });
      }
    });
  };

  return (
    <div style={{ position:"relative", marginBottom:8 }}>
      <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", zIndex:2 }}>{icon}</div>
      <input
        ref={inputRef}
        value={query}
        onChange={handleChange}
        onFocus={() => suggestions.length && setShowDrop(true)}
        onBlur={() => setTimeout(()=>setShowDrop(false),200)}
        placeholder={placeholder}
        style={{
          width:"100%", background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:13, padding:"14px 14px 14px 38px",
          color:"#e8e8f8", fontSize:14, fontFamily:"Outfit,sans-serif", outline:"none",
        }}
      />
      {showDrop && suggestions.length > 0 && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, right:0,
          background:"#13132a", border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:13, zIndex:100, overflow:"hidden",
          boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {suggestions.map((s,i) => (
            <div key={i} onMouseDown={()=>handleSelect(s)} style={{
              padding:"12px 16px", cursor:"pointer", borderBottom: i<suggestions.length-1?"1px solid rgba(255,255,255,0.05)":"none",
              display:"flex", alignItems:"flex-start", gap:10,
              transition:"background 0.15s",
            }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(108,99,255,0.15)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            >
              <span style={{fontSize:16,marginTop:1}}>📍</span>
              <div>
                <div style={{color:"#e0e0f0",fontSize:13,fontWeight:600,fontFamily:"Outfit,sans-serif"}}>{s.structured_formatting.main_text}</div>
                <div style={{color:"#4a4a6a",fontSize:11,marginTop:2,fontFamily:"Outfit,sans-serif"}}>{s.structured_formatting.secondary_text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────
function Badge({label,color}) {
  return <span style={{background:color+"22",color,border:`1px solid ${color}55`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:800,letterSpacing:0.4,whiteSpace:"nowrap"}}>{label}</span>;
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:18,padding:"20px",border:"1px solid rgba(255,255,255,0.06)",marginBottom:10,display:"flex",gap:14,alignItems:"center"}}>
      <div style={{width:46,height:46,borderRadius:13,background:"rgba(255,255,255,0.08)",animation:"pulse 1.4s ease infinite"}}/>
      <div style={{flex:1}}>
        <div style={{height:12,width:"40%",background:"rgba(255,255,255,0.08)",borderRadius:6,marginBottom:8,animation:"pulse 1.4s ease infinite"}}/>
        <div style={{height:10,width:"60%",background:"rgba(255,255,255,0.05)",borderRadius:6,animation:"pulse 1.4s ease infinite"}}/>
      </div>
      <div style={{height:24,width:58,background:"rgba(255,255,255,0.08)",borderRadius:8,animation:"pulse 1.4s ease infinite"}}/>
    </div>
  );
}

// ── Fare Card ────────────────────────────────────────────────────────────────
function FareCard({agg,isBest,isWorst,idx,onBook}) {
  const [hov,setHov]=useState(false);
  if (!agg.available) return (
    <div style={{background:"rgba(255,255,255,0.02)",borderRadius:18,padding:"18px 20px",border:"1px solid rgba(255,255,255,0.05)",marginBottom:10,display:"flex",gap:14,alignItems:"center",opacity:0.32}}>
      <div style={{width:46,height:46,borderRadius:13,background:agg.bg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,color:agg.fg,flexShrink:0}}>{agg.logo}</div>
      <div style={{flex:1}}>
        <div style={{color:"#888",fontWeight:600,fontSize:14,fontFamily:"Outfit,sans-serif"}}>{agg.name}</div>
        <div style={{color:"#555",fontSize:11,marginTop:2,fontFamily:"Outfit,sans-serif"}}>Not available</div>
      </div>
      <span style={{color:"#444"}}>—</span>
    </div>
  );
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={()=>onBook(agg)}
      style={{
        background:isBest?"linear-gradient(135deg,rgba(0,210,100,0.13),rgba(0,180,80,0.05))":hov?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.03)",
        borderRadius:18,padding:"20px",marginBottom:10,
        border:isBest?"1.5px solid rgba(0,210,100,0.45)":"1px solid rgba(255,255,255,0.08)",
        display:"flex",alignItems:"center",gap:14,cursor:"pointer",
        transition:"all 0.2s ease",transform:hov?"translateY(-2px)":"none",
        boxShadow:isBest?"0 8px 32px rgba(0,210,100,0.12)":hov?"0 4px 24px rgba(0,0,0,0.3)":"none",
        animation:`riseIn 0.45s ${idx*80}ms ease both`,
      }}>
      <div style={{width:46,height:46,borderRadius:13,background:agg.bg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,color:agg.fg,flexShrink:0,boxShadow:`0 4px 14px ${agg.bg}88`}}>{agg.logo}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
          <span style={{color:"#f0f0f8",fontWeight:700,fontSize:15,fontFamily:"Outfit,sans-serif"}}>{agg.name}</span>
          {isBest&&<Badge label="✓ BEST" color="#00d264"/>}
          {isWorst&&<Badge label="PRICIEST" color="#ff4d6d"/>}
          {agg.surge&&<Badge label={`⚡ ${agg.surge}x`} color="#ff9500"/>}
        </div>
        <div style={{color:"#4a4a6a",fontSize:12,fontFamily:"Outfit,sans-serif"}}>{agg.eta} min · {agg.km} km</div>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{color:isBest?"#00e676":"#e8e8f8",fontWeight:800,fontSize:22,fontFamily:"Outfit,sans-serif"}}>₹{agg.fare}</div>
        <div style={{color:"#2a2a4a",fontSize:10,marginTop:1,fontFamily:"Outfit,sans-serif"}}>est. fare</div>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function OmniFare() {
  const mapsReady = useGoogleMaps();
  const [pickupPlace, setPickupPlace] = useState(null);
  const [dropPlace,   setDropPlace]   = useState(null);
  const [vehicle,  setVehicle]  = useState("Mini");
  const [screen,   setScreen]   = useState("home");
  const [fares,    setFares]    = useState([]);
  const [booked,   setBooked]   = useState(null);
  const [totalSaved, setTotalSaved] = useState(0);
  const [rides,    setRides]    = useState(0);
  const [km,       setKm]       = useState(0);
  const [smartSave,setSmartSave]= useState(null);

  const canSearch = pickupPlace && dropPlace;

  const doSearch = () => {
    if (!canSearch) return;
    setScreen("loading");
    setTimeout(() => {
      const dist = Math.max(1.5, haversineKm(pickupPlace, dropPlace));
      setKm(dist);
      const raw = calcFares(dist, vehicle);
      const sorted = [...raw].sort((a,b) => {
        if (!a.available&&b.available) return 1;
        if (a.available&&!b.available) return -1;
        return a.fare-b.fare;
      });
      setFares(sorted);
      const avail = sorted.filter(f=>f.available);
      if (avail.length>=2&&dist>3) {
        const s = Math.round((avail[avail.length-1].fare-avail[0].fare)*0.3/5)*5;
        setSmartSave(s>=15?s:null);
      } else setSmartSave(null);
      setScreen("results");
    }, 1800);
  };

  const doBook = (agg) => {
    const avail = fares.filter(f=>f.available);
    const maxF  = Math.max(...avail.map(f=>f.fare));
    const saved = Math.max(0, maxF-agg.fare);
    setTotalSaved(p=>p+saved);
    setRides(p=>p+1);
    setBooked(agg);
    window.open(deepLink(agg.id, pickupPlace.name, dropPlace.name), "_blank");
    setScreen("booked");
  };

  const avail     = fares.filter(f=>f.available);
  const bestFare  = avail.length?Math.min(...avail.map(f=>f.fare)):null;
  const worstFare = avail.length?Math.max(...avail.map(f=>f.fare)):null;
  const saving    = bestFare&&worstFare?worstFare-bestFare:0;

  const iconDot = <div style={{width:10,height:10,borderRadius:"50%",border:"2.5px solid #6C63FF"}}/>;
  const iconSquare = <div style={{width:10,height:10,borderRadius:2,background:"#00d264"}}/>;

  return (
    <div style={{minHeight:"100vh",background:"#080814",backgroundImage:"radial-gradient(ellipse 80% 50% at 50% -20%,rgba(108,99,255,0.18),transparent)",display:"flex",justifyContent:"center",padding:"0 16px 48px",fontFamily:"Outfit,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Sora:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes riseIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:0.35}50%{opacity:0.8}}
        input::placeholder{color:#2e2e52;}
        ::-webkit-scrollbar{width:0;}
        button:active{transform:scale(0.97);}
      `}</style>

      <div style={{width:"100%",maxWidth:440}}>

        {/* Header */}
        <div style={{padding:"28px 0 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,#6C63FF,#00d264)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Sora,sans-serif",fontWeight:800,fontSize:19,color:"#fff"}}>O</div>
              <span style={{fontFamily:"Sora,sans-serif",fontWeight:800,fontSize:24,color:"#fff",letterSpacing:"-0.5px"}}>Omni<span style={{color:"#6C63FF"}}>Fare</span></span>
            </div>
            <div style={{color:"#2e2e52",fontSize:12,marginTop:4,marginLeft:48}}>Compare all cabs. Pay less. Always.</div>
          </div>
          {rides>0&&(
            <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"8px 14px",textAlign:"center"}}>
              <div style={{color:"#00d264",fontFamily:"Sora,sans-serif",fontWeight:800,fontSize:17}}>₹{totalSaved}</div>
              <div style={{color:"#2e2e52",fontSize:10,marginTop:1}}>saved · {rides} ride{rides!==1?"s":""}</div>
            </div>
          )}
        </div>

        {/* HOME */}
        {screen==="home"&&(
          <div style={{animation:"riseIn 0.4s ease both"}}>
            {!mapsReady&&(
              <div style={{background:"rgba(108,99,255,0.1)",border:"1px solid rgba(108,99,255,0.2)",borderRadius:12,padding:"10px 16px",marginBottom:12,color:"#9d96ff",fontSize:13,textAlign:"center"}}>
                ⏳ Loading Google Maps…
              </div>
            )}
            <div style={{background:"rgba(255,255,255,0.04)",borderRadius:22,border:"1px solid rgba(255,255,255,0.08)",padding:20,marginBottom:16}}>
              <PlacesInput
                placeholder="Pickup location"
                value={pickupPlace?.name||""}
                onSelect={setPickupPlace}
                icon={iconDot}
                mapsReady={mapsReady}
              />
              <div style={{width:1,height:8,background:"rgba(255,255,255,0.08)",marginLeft:18,marginBottom:8}}/>
              <PlacesInput
                placeholder="Drop location"
                value={dropPlace?.name||""}
                onSelect={setDropPlace}
                icon={iconSquare}
                mapsReady={mapsReady}
              />

              <div style={{display:"flex",gap:7,margin:"18px 0",overflowX:"auto",paddingBottom:2}}>
                {VEHICLES.map(v=>(
                  <button key={v} onClick={()=>setVehicle(v)} style={{background:vehicle===v?"#6C63FF":"rgba(255,255,255,0.04)",border:vehicle===v?"1px solid #6C63FF":"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 15px",color:vehicle===v?"#fff":"#4a4a6a",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"Outfit,sans-serif",transition:"all 0.15s ease"}}>{v}</button>
                ))}
              </div>

              <button onClick={doSearch} disabled={!canSearch} style={{width:"100%",background:canSearch?"linear-gradient(135deg,#6C63FF,#00d264)":"rgba(255,255,255,0.05)",border:"none",borderRadius:14,padding:"16px",color:canSearch?"#fff":"#2e2e52",fontSize:15,fontWeight:800,cursor:canSearch?"pointer":"not-allowed",fontFamily:"Outfit,sans-serif",transition:"all 0.2s ease"}}>
                {canSearch?"Compare Fares →":"Enter pickup & drop to compare"}
              </button>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
              {[{icon:"🏠",label:"Home"},{icon:"💼",label:"Office"},{icon:"✈️",label:"Airport"},{icon:"🚉",label:"Station"}].map(q=>(
                <div key={q.label} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"14px 16px",display:"flex",alignItems:"center",gap:10,opacity:0.5}}>
                  <span style={{fontSize:22}}>{q.icon}</span>
                  <span style={{color:"#d0d0e8",fontWeight:700,fontSize:14,fontFamily:"Outfit,sans-serif"}}>{q.label}</span>
                </div>
              ))}
            </div>

            <div style={{textAlign:"center"}}>
              <div style={{color:"#1e1e38",fontSize:11,marginBottom:12,letterSpacing:1}}>COMPARING ACROSS</div>
              <div style={{display:"flex",justifyContent:"center",gap:12}}>
                {AGGS.map(a=>(
                  <div key={a.id} style={{width:42,height:42,borderRadius:12,background:a.bg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:17,color:a.fg,boxShadow:`0 4px 12px ${a.bg}66`}}>{a.logo}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LOADING */}
        {screen==="loading"&&(
          <div style={{animation:"fadeIn 0.3s ease",textAlign:"center",paddingTop:50}}>
            <div style={{width:52,height:52,borderRadius:"50%",border:"3px solid rgba(108,99,255,0.2)",borderTop:"3px solid #6C63FF",animation:"spin 0.8s linear infinite",margin:"0 auto 22px"}}/>
            <div style={{color:"#e0e0f0",fontWeight:700,fontSize:17,marginBottom:8}}>Fetching best fares…</div>
            <div style={{color:"#2e2e52",fontSize:13,marginBottom:36}}>Checking Uber · Ola · Rapido · Namma Yatri</div>
            {[0,1,2,3].map(i=><Skeleton key={i}/>)}
          </div>
        )}

        {/* RESULTS */}
        {screen==="results"&&(
          <div style={{animation:"fadeIn 0.3s ease"}}>
            <div style={{background:"rgba(255,255,255,0.04)",borderRadius:18,padding:"14px 18px",border:"1px solid rgba(255,255,255,0.08)",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
              <button onClick={()=>setScreen("home")} style={{background:"none",border:"none",color:"#6C63FF",fontSize:22,cursor:"pointer",lineHeight:1,flexShrink:0}}>←</button>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"#e0e0f0",fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pickupPlace?.name}</div>
                <div style={{color:"#1e1e38",fontSize:10,margin:"2px 0"}}>↓ {km.toFixed(1)} km</div>
                <div style={{color:"#00d264",fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dropPlace?.name}</div>
              </div>
              <div style={{background:"rgba(108,99,255,0.15)",border:"1px solid rgba(108,99,255,0.3)",borderRadius:9,padding:"5px 11px",color:"#9d96ff",fontSize:12,fontWeight:700,flexShrink:0}}>{vehicle}</div>
            </div>

            {saving>0&&(
              <div style={{background:"linear-gradient(135deg,rgba(0,210,100,0.13),rgba(0,180,80,0.06))",border:"1px solid rgba(0,210,100,0.3)",borderRadius:14,padding:"13px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:22}}>💰</span>
                <div>
                  <div style={{color:"#00d264",fontWeight:800,fontSize:14,fontFamily:"Outfit,sans-serif"}}>Save ₹{saving} on this ride</div>
                  <div style={{color:"#00804a",fontSize:12,marginTop:1,fontFamily:"Outfit,sans-serif"}}>vs. the most expensive option right now</div>
                </div>
              </div>
            )}

            {smartSave&&(
              <div style={{background:"rgba(108,99,255,0.1)",border:"1px solid rgba(108,99,255,0.25)",borderRadius:14,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:20}}>🚶</span>
                <div>
                  <div style={{color:"#9d96ff",fontWeight:700,fontSize:13,fontFamily:"Outfit,sans-serif"}}>Smart Pickup</div>
                  <div style={{color:"#5a5488",fontSize:12,marginTop:1,fontFamily:"Outfit,sans-serif"}}>Walk 4 min to a nearby point · save up to ₹{smartSave} more</div>
                </div>
              </div>
            )}

            {fares.map((agg,i)=>(
              <FareCard key={agg.id} agg={agg} idx={i}
                isBest={agg.available&&agg.fare===bestFare}
                isWorst={agg.available&&agg.fare===worstFare}
                onBook={doBook}/>
            ))}

            <div style={{color:"#1e1e38",fontSize:11,textAlign:"center",marginTop:16,lineHeight:1.8}}>
              Fares are estimates. Final price shown in the app.<br/>Tap any card to book instantly.
            </div>
          </div>
        )}

        {/* BOOKED */}
        {screen==="booked"&&booked&&(
          <div style={{animation:"riseIn 0.4s ease both",textAlign:"center",paddingTop:16}}>
            <div style={{background:"rgba(255,255,255,0.03)",borderRadius:24,padding:"36px 24px",border:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{fontSize:58,marginBottom:16}}>🎉</div>
              <div style={{color:"#00d264",fontFamily:"Sora,sans-serif",fontWeight:800,fontSize:20,marginBottom:8}}>Opening {booked.name}…</div>
              <div style={{color:"#4a4a6a",fontSize:13,marginBottom:28,lineHeight:1.7}}>
                Booking for <strong style={{color:"#e0e0f0"}}>₹{booked.fare}</strong>.<br/>If the app didn't open, tap below.
              </div>
              <a href={deepLink(booked.id,pickupPlace?.name,dropPlace?.name)} target="_blank" rel="noreferrer"
                style={{display:"block",background:booked.bg,color:booked.fg,borderRadius:14,padding:"14px",marginBottom:16,fontWeight:800,fontSize:15,textDecoration:"none",fontFamily:"Outfit,sans-serif"}}>
                Open {booked.name} →
              </a>
              {totalSaved>0&&(
                <div style={{background:"rgba(0,210,100,0.08)",border:"1px solid rgba(0,210,100,0.2)",borderRadius:14,padding:"16px",marginBottom:20}}>
                  <div style={{color:"#00d264",fontFamily:"Sora,sans-serif",fontWeight:800,fontSize:28}}>₹{totalSaved}</div>
                  <div style={{color:"#004a28",fontSize:12,marginTop:4,fontFamily:"Outfit,sans-serif"}}>saved across {rides} ride{rides!==1?"s":""} with OmniFare</div>
                </div>
              )}
              <button onClick={()=>{setScreen("home");setFares([]);setBooked(null);}}
                style={{background:"linear-gradient(135deg,#6C63FF,#00d264)",border:"none",borderRadius:14,padding:"14px",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"Outfit,sans-serif",width:"100%"}}>
                Compare Another Ride
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
