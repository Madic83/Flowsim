import React from 'react'
import '../styles/akutmottagning.css'

export default function Akutmottagning({ onClose }){
  return (
    <div className="akut-full-screen">
      <div className="akut-topbar">
        <div className="akut-title">Akutmottagning — Enhetsöversikt</div>
        <div>
          <button className="akut-btn" onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); if (onClose) onClose(); }}>Stäng</button>
        </div>
      </div>

      <div className="akut-content">
        {/* Placeholder content - replace with real table/layout as needed */}
        <p>Här visas listan med patienter och kolumner (PRIO, Starttid, Plats, Namn osv.).</p>
      </div>
    </div>
  )
}
