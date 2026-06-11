import React from 'react';

export default function PersonalView({ hospitalPersonnel }) {
  return (
    <div style={{padding:32}}>
      <h2>Personalöversikt</h2>
      <table style={{borderCollapse:'collapse',width:'100%',fontSize:15}}>
        <thead>
          <tr style={{background:'#e0e0e0'}}>
            <th style={{border:'1px solid #ccc',padding:'8px'}}>Kategori</th>
            <th style={{border:'1px solid #ccc',padding:'8px'}}>Antal</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(hospitalPersonnel).map(([key, value]) => (
            <tr key={key}>
              <td style={{border:'1px solid #ccc',padding:'8px'}}>{key}</td>
              <td style={{border:'1px solid #ccc',padding:'8px'}}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
