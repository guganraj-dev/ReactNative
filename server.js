const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path'); 
const app = express();
require('dotenv').config();


app.use(express.json());



mongoose.connect(process.env.MONGODB_URI)
.then(()=>{

console.log('connect')
})



const nameSchema = new mongoose.Schema({ name: String });
const Name = mongoose.model('Name', nameSchema);

const gmailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Name' },
  gmail: String,
});
const Gmail = mongoose.model('Gmail', gmailSchema);




app.get('/api/user', async (req, res) => {
  try {
    const result = await Name.aggregate([
      {
        $lookup: {
          from: "gmails",           // Collection that stores gmail addresses
          localField: "_id",
          foreignField: "userId",
          as: "gmail"
        }
      },
      {
        $unwind: {
          path: "$gmail",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          gmail: { $ifNull: ["$gmail.gmail", "Not found"] }
        }
      }
    ]);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong', details: err.message });
  }
});


app.get('/api/user/:id', async (req, res) => { 
  try {
    const id = new mongoose.Types.ObjectId(req.params.id); 

    const result = await Name.aggregate([
      { $match: { _id: id } }, 

      
      {
        $lookup: {
          from: "gmails",           
          localField: "_id",
          foreignField: "userId",
          as: "gmail"
        }
      },

      
      { $unwind: { path: "$gmail", preserveNullAndEmptyArrays: true } },


      
      {
        $project: {
          _id: 0,
          name: "$name",
          gmail: { $ifNull: ["$gmail.gmail", "Not found"] },
        }
      }
    ]);

    if (result.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong', details: err.message });
  }
});




app.post('/api/user', async (req, res) => {
  try {
    const { name, gmail } = req.body;

   
    const nameDoc = new Name({ name });
    await nameDoc.save();

 
    const gmailDoc = new Gmail({ userId: nameDoc._id, gmail });
    await gmailDoc.save();


    res.status(201).json({
      message: 'User data inserted',
      userId: nameDoc._id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




const uploadFolder = 'uploads';


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {

    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});


const upload = multer({ storage });


app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    console.log('⚠️ File not received');
    return res.status(400).json({ message: 'No image uploaded' });
  }

  console.log('✅ File received:', req.file);

  const fileUrl = `http://192.168.1.13:3000/uploads/${req.file.filename}`;

  res.json({
    message: 'Image uploaded successfully',
    file: {
      filename: req.file.filename,
      url: fileUrl,
    },
  });
});


// Serve uploaded files statically so frontend can access them
  app.use('/uploads', express.static(path.join(__dirname, uploadFolder)));




// 📸 List all uploaded image files
app.get('/photos', (req, res) => {
  fs.readdir('uploads', (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to read uploads folder' });

    const imageUrls = files.map(file => ({
      filename: file,
      url: `http://192.168.1.13:3000/uploads/${file}`,
    }));

    res.json(imageUrls);
  });
});









app.delete('/api/user/:id', async (req, res) => {
  try {
    const id = new mongoose.Types.ObjectId(req.params.id);

    const result = await Name.aggregate([
      { $match: { _id: id } }
    ]);

    if (result.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    await Name.findByIdAndDelete(id);
    await Gmail.deleteMany({ userId: id });               
    res.json({ message: 'User deleted successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong', details: err.message });
  }
});


app.put('/api/user/:id', async (req, res) => {
  try {
    const id = new mongoose.Types.ObjectId(req.params.id);
    const { name, gmail } = req.body;

    console.log("📝 Update request received for ID:", id);
    console.log("➡️ New name:", name, "| New gmail:", gmail);

    // Update name in Name collection
    const nameUpdate = await Name.updateOne(
      { _id: id },
      { $set: { name } }
    );

    // Update gmail in Gmail collection
    const gmailUpdate = await Gmail.updateOne(
      { userId: id },
      { $set: { gmail } }
    );

    res.json({
      message: "✅ User updated successfully",
      nameUpdate,
      gmailUpdate
    });
  } catch (err) {
    console.error("❌ Error updating user:", err);
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
});






const PORT = 3000;
app.listen(PORT,'0.0.0.0',() => {
  console.log(`Server running on http://localhost:${PORT}`);
});












































