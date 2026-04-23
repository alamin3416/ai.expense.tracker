import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [files, setFiles] = useState([]); // Changed to handle multiple files
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/receipts');
      setHistory(res.data);
    } catch (err) {
      console.error("Error fetching history");
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Update to handle multiple files
  const handleFileChange = (e) => { 
    setFiles(e.target.files); 
  };

  const handleUpload = async () => {
    if (files.length === 0) return alert("Select at least one file!");
    
    const formData = new FormData();
    // Loop to add all selected files to the request
    for (let i = 0; i < files.length; i++) {
      formData.append('receipts', files[i]);
    }

    try {
      setMessage('AI is processing multiple files...');
      await axios.post('http://localhost:5000/api/upload', formData);
      setMessage("Success! All receipts categorized and saved.");
      setFiles([]); // Clear selection
      fetchHistory(); // Refresh the grid
    } catch (error) {
      setMessage('Upload failed.');
    }
  };

  // Function to trigger the Excel/CSV download
  const downloadExcel = () => {
    window.open('http://localhost:5000/api/export', '_blank');
  };

  return (
    <div className="App">
      <h1>AI Receipt Tracker Pro</h1>
      
      <div className="upload-section">
        {/* 'multiple' attribute allows selecting many files at once */}
        <input type="file" multiple onChange={handleFileChange} />
        <button onClick={handleUpload}>Upload & Analyze All</button>
        <button onClick={downloadExcel} style={{marginLeft: '10px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'}}>
          Download Excel (CSV)
        </button>
      </div>

      <p><strong>Status:</strong> {message}</p>

      <div className="history-section">
        <h2>Expense History</h2>
        <ul>
          {history.map((item) => (
            <li key={item.id}>
              <strong>ID: {item.id}</strong>
              <span className="category-tag">{item.category}</span>
              <p className="date-text">{item.date}</p>
              <p className="preview-text">{item.content.substring(0, 100)}...</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
