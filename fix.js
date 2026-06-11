// This script shows what needs to be changed in MapPanel.jsx

// OLD CODE (around line 2187):
// onClick={() => setOpenTriagePatient(p.id)}

// NEW CODE:
// onClick={() => {
//   setOpenTriagePatient(p.id);
//   setTimeout(() => {
//     document.querySelectorAll('.leaflet-popup-close-button').forEach(btn => btn.click());
//   }, 0);
// }}

// ALSO REMOVE (lines 2193-2214):
// {/* Skicka till sjukhus-knapp i patientpopup från uppsamlingsplatsens lista */}
// {openTriagePatient === p.id && (
//   <div style={{marginTop:8}}>
//     <button...>Skicka till sjukhus</button>
//   </div>
// )}

// This change makes clicking a patient in the collection point list:
// 1. Open the full information modal (already implemented)
// 2. Close the Leaflet popup so the modal is visible
// 3. Remove the inline "Skicka till sjukhus" button (since it's already in the modal)
