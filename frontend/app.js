async function fetchLessons(){
  const res = await fetch('/api/lessons');
  if (!res.ok) return document.getElementById('lessons').innerText = 'Kunde inte hämta lektioner.';
  const lessons = await res.json();
  const el = document.getElementById('lessons');
  el.innerHTML = '';
  lessons.forEach(l => {
    const card = document.createElement('div');
    card.style.border = '1px solid #ddd'; card.style.padding = '10px'; card.style.marginBottom = '10px';
    const h = document.createElement('h3'); h.innerText = l.title; card.appendChild(h);
    const p = document.createElement('p'); p.innerText = l.content; card.appendChild(p);
    const btn = document.createElement('button'); btn.innerText = 'Markera som klar';
    btn.onclick = async ()=>{
      await fetch('/api/progress', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user:'demo', lesson_id:l.id, completed:true})});
      alert('Markerad som klar');
    }
    card.appendChild(btn);
    el.appendChild(card);
  })
}

fetchLessons();

// Hospital control buttons
function onHospitalSelect(name){
  alert('Valt: ' + name);
}

document.addEventListener('DOMContentLoaded', ()=>{
  const b1 = document.getElementById('btn-nus');
  const b2 = document.getElementById('btn-skelleftea');
  const b3 = document.getElementById('btn-lycksele');
  if (b1) b1.addEventListener('click', ()=>onHospitalSelect('Norrlands universitetssjukhus'));
  if (b2) b2.addEventListener('click', ()=>onHospitalSelect('Skellefteå sjukhus'));
  if (b3) b3.addEventListener('click', ()=>onHospitalSelect('Lycksele lasarett'));
});
