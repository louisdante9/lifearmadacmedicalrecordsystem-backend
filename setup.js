const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Life Armada Medical Record System...\n');

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, 'env.example');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ Created .env file from env.example');
} else {
  console.log('ℹ️  .env file already exists or env.example not found');
}

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory');
}

console.log('\n🎉 Setup complete!');
console.log('\nNext steps:');
console.log('1. Update .env file with your configuration');
console.log('2. Make sure MongoDB is running');
console.log('3. Run: npm install');
console.log('4. Run: npm run dev');
console.log('\n📚 Check README.md for detailed documentation');


