const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Setup Database
const db = new sqlite3.Database('./expenses.db');
db.run(`CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    category TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 2. Setup Multer Storage (Must be ABOVE the routes)
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, './'); },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });

// 3. AI Logic: Categorization & Price Extraction
const analyzeReceipt = (text) => {
    const input = text.toLowerCase();
    
    // 1. Improved Category Search
    let category = 'General/Other';
    if (input.match(/burger|pizza|cafe|restaurant|food|price|shop|mcdonald|starbucks|eat|kfc/)) category = 'Food & Dining';
    else if (input.match(/uber|taxi|gas|fuel|train|shell|petrol|bolt|transport/)) category = 'Transportation';
    else if (input.match(/walmart|target|amazon|grocery|supermarket|tesco|aldi|lorem/)) category = 'Grocery';
    else if (input.match(/spotify|netflix|receiptify|cinema|movie|show|theatre/)) category = 'Entertainment';

    // 2. The "Highest Price" Logic
    // This regex grabs numbers with decimals, even if they use a comma instead of a dot
    const priceRegex = /\d+[\.,]\d{1,2}/g; 
    const matches = text.match(priceRegex);
    let amount = "0.00";

    if (matches) {
        const prices = matches
            .map(p => p.replace(',', '.')) // Convert 16,5 to 16.5
            .map(Number)
            .filter(n => n < 5000); // Ignore huge numbers that might be phone numbers

        if (prices.length > 0) {
            // The magic line: always pick the maximum value found on the receipt
            amount = Math.max(...prices).toFixed(2);
        }
    }

    return { category, amount };
};

// 4. THE UPLOAD ROUTE (Clean & Single)
app.post('/api/upload', upload.array('receipts', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ message: "No files uploaded" });

    try {
        for (const file of req.files) {
            console.log(`AI is reading: ${file.originalname}`);
            const { data: { text } } = await Tesseract.recognize(file.path, 'eng');
            const { category, amount } = analyzeReceipt(text);

            const finalContent = `Total: $${amount} | ${text}`;
            const stmt = db.prepare("INSERT INTO receipts (content, category) VALUES (?, ?)");
            stmt.run(finalContent, category);
            stmt.finalize();
        }
        res.json({ message: "Success! All files processed." });
    } catch (err) {
        console.error("AI Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 5. EXPORT ROUTE
app.get('/api/export', (req, res) => {
    db.all("SELECT * FROM receipts", [], (err, rows) => {
        if (err) return res.status(500).send(err);

        // Header for Excel
        let csv = "id,Date,Category,Spent_Amount\n";
        
        rows.forEach(row => {
            // We pull the amount out of the content string we saved earlier: "Total: $XX.XX | ..."
            const amountMatch = row.content.match(/Total: \$(\d+\.\d{2})/);
            const amount = amountMatch ? amountMatch[1] : "0.00";
            
            // Clean date for Excel (YYYY-MM-DD)
            const cleanDate = row.date.split(' ')[0];

            csv += `${row.id},${cleanDate},${row.category},${amount}\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('Monthly_Spending_Report.csv');
        res.send(csv);
    });
});

app.get('/api/receipts', (req, res) => {
    db.all("SELECT * FROM receipts ORDER BY date DESC", [], (err, rows) => {
        res.json(rows || []);
    });
});

app.listen(5000, () => {
    console.log(`Server running on port 5000`);
    console.log(`Connected to the SQLite database.`);
});