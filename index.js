const express = require("express")
const app = express()
const port = 8080;
const path = require('path');
const mysql = require("mysql2");
const { availableMemory } = require("process");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "1975Nity@",  
    database: "FarmerBuyerDB"
});


db.connect(err => {
    if (err) throw err;
    console.log("✅ MySQL Connected...");
})

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname,"views"));

app.use(express.static(path.join(__dirname,"public")));



// Home Route
app.get("/home",(req,res)=>{
    res.render("index.ejs")
})


// Choose Route
app.get("/home/choose",(req,res)=>{
    res.render("option.ejs")
})


// FArmer Profile Route
app.get("/home/choose/farmer/profile", (req, res) => {
    const sql = 'SELECT * FROM crops WHERE status = "available"';
    
    db.query(sql, (err, crops) => {
        const profitSql = 'SELECT SUM(sold_price - base_price) AS total_profit FROM crops WHERE status = "sold"';
        db.query(profitSql, (err, profitResult) => {
            res.render("farmprofile", { crops: crops, totalProfit: profitResult[0].total_profit || 0 });
        });
    });
});

// Add Crops Route
app.get("/home/choose/farmer/profile/add",(req,res)=>{
    res.render("addcrop.ejs")
})

// Fetch from Form and add to data base
app.post("/home/choose/farmer/profile/add", (req, res) => {
    const { name, variety, quantity, quality, base_price, location, delivery_option, contact_info, image_url } = req.body;
    
    const sql = `INSERT INTO Crops (name, variety, quantity, quality, base_price, location, delivery_option, contact_info, status, image_url) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?)`;

    db.query(sql, [name, variety, quantity, quality, base_price, location, delivery_option, contact_info, image_url], (err, result) => {
        if (err) {
            console.error("Error inserting crop:", err);
            return res.status(500).send("Database error");
        }
        console.log("✅ Crop added successfully!");
        res.redirect("/home/choose/farmer/profile"); 
    });
});



// Sell Crops On Farm Profile
app.post("/sell-crop", (req, res) => {
    const { crop_id, price } = req.body;
    db.query("UPDATE Crops SET status = 'sold', sold_price = ? WHERE crop_id = ?", [price, crop_id]);
    res.sendStatus(200);
});





// Buyer Route
app.get('/home/choose/buyer', (req, res) => {
    const sql = 'SELECT * FROM crops WHERE status = "available"' 

    db.query(sql, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send("Database error");
        }

        console.log("Crops Data from DB:", results); 

        res.render('buyer', { crops: results });
    });
});



// load form for place bid
app.get('/home/choose/buyer/:id/bid',(req,res)=>{
    const cropId = req.params.id;

    db.query("SELECT * FROM Crops WHERE crop_id = ?", [cropId], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).send("Database error");
        }

        if (results.length === 0) {
            return res.status(404).send("Crop not found");
        }

        res.render("bid.ejs", { crop: results[0] });

    });
})



// add bid to data base
app.post('/home/choose/buyer/:id/bid', (req, res) => {
    const { crop_id, bid_amount, buyer_name } = req.body;

    const updateSql = `
        UPDATE Crops 
        SET current_bid = ?, buyer_name = ? 
        WHERE crop_id = ? AND (current_bid IS NULL OR ? > current_bid)
    `;

    db.query(updateSql, [bid_amount, buyer_name, crop_id, bid_amount], (err) => {
        if (err) {
            console.error("Database error:", err.sqlMessage);
            return res.status(500).send("Database error: " + err.sqlMessage);
        }

        
        const insertSql = `
            INSERT INTO Bids (crop_id, buyer_name, bid_amount) 
            VALUES (?, ?, ?)
        `;
        
        db.query(insertSql, [crop_id, buyer_name, bid_amount], (err) => {
            if (err) {
                console.error("Database error:", err.sqlMessage);
                return res.status(500).send("Database error: " + err.sqlMessage);
            }
            res.redirect("/home/choose/buyer");
        });
    });
});









// port listening
app.listen(port, ()=>{
    console.log("listening to port: 8080")
});












app.get("/crop-prices", async (req, res) => {
    try {
        const [crops] = await db.promise().query("SELECT name, base_price FROM Crops WHERE status = 'available'");
        res.json(crops);
    } catch (error) {
        console.error("Error fetching crop prices:", error);
        res.status(500).json({ error: "Failed to fetch crop prices" });
    }
});







// new edited code 



app.get("/home/choose/buyer/:id/bids", (req, res) => {
    const cropId = req.params.id;

    const sql = "SELECT buyer_name, bid_amount , bid_time FROM Bids WHERE crop_id = ? ORDER BY bid_amount DESC";
    
    db.query(sql, [cropId], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});




app.get("/home/choose/buyer/:cropId/bids", async (req, res) => {
    const { cropId } = req.params;
    const bids = await getBidsForCrop(cropId); // Fetch bids from DB
    bids.sort((a, b) => b.bid_amount - a.bid_amount); // Sort in descending order

    res.render("bids", { bids }); // Pass sorted bids to EJS
});




