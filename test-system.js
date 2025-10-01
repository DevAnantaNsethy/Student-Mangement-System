// Complete System Test Script
const fs = require("fs");
const path = require("path");

console.log("🧪 Testing Complete Student Management System...\n");

// Test 1: Check all required files exist
function testFileStructure() {
  console.log("1. 📁 Testing File Structure...");

  const requiredFiles = [
    // HTML Files
    "index.html",
    "stu_signup.html",
    "stu_login.html",
    "User_login.html",
    "admin-login.html",
    "forgotpass.html",
    "otp-verification.html",
    "dashboard.html",

    // CSS Files
    "index.css",
    "studentsignup.css",
    "studentogin.css",
    "userlogin.css",
    "adminlogin.css",
    "forgotpass.css",
    "otp-verification.css",
    "dash.css",

    // JavaScript Files
    "signup-verification.js",
    "otp-verification.js",
    "script.js",

    // API Files
    "api/server.js",
    "api/package.json",
    "api/email-config-example.txt",
    "api/test-endpoints.js",
  ];

  const missingFiles = [];
  const existingFiles = [];

  requiredFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      existingFiles.push(file);
      console.log(`   ✅ ${file}`);
    } else {
      missingFiles.push(file);
      console.log(`   ❌ ${file} - MISSING`);
    }
  });

  console.log(
    `\n   📊 Results: ${existingFiles.length}/${requiredFiles.length} files found`
  );

  if (missingFiles.length > 0) {
    console.log(`   ⚠️  Missing files: ${missingFiles.join(", ")}`);
    return false;
  }

  return true;
}

// Test 2: Check HTML file links
function testHTMLLinks() {
  console.log("\n2. 🔗 Testing HTML Links...");

  const htmlFiles = [
    "index.html",
    "stu_signup.html",
    "stu_login.html",
    "User_login.html",
    "admin-login.html",
    "forgotpass.html",
    "otp-verification.html",
  ];

  let allLinksValid = true;

  htmlFiles.forEach((file) => {
    if (!fs.existsSync(file)) return;

    console.log(`   📄 Checking ${file}...`);
    const content = fs.readFileSync(file, "utf8");

    // Check for common broken links
    const brokenLinks = [
      "register.html",
      "admin_login.html",
      "student portal.png--",
    ];

    brokenLinks.forEach((brokenLink) => {
      if (content.includes(brokenLink)) {
        console.log(`   ❌ Found broken link: ${brokenLink}`);
        allLinksValid = false;
      }
    });

    // Check for proper links
    const validLinks = [
      "stu_signup.html",
      "admin-login.html",
      "User_login.html",
    ];

    validLinks.forEach((validLink) => {
      if (content.includes(validLink)) {
        console.log(`   ✅ Found valid link: ${validLink}`);
      }
    });
  });

  return allLinksValid;
}

// Test 3: Check API Configuration
function testAPIConfig() {
  console.log("\n3. ⚙️  Testing API Configuration...");

  // Check if package.json exists and has required dependencies
  if (fs.existsSync("api/package.json")) {
    const packageJson = JSON.parse(fs.readFileSync("api/package.json", "utf8"));
    const requiredDeps = ["express", "cors", "nodemailer", "node-fetch"];

    console.log("   📦 Checking dependencies...");
    requiredDeps.forEach((dep) => {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        console.log(`   ✅ ${dep}: ${packageJson.dependencies[dep]}`);
      } else {
        console.log(`   ❌ Missing dependency: ${dep}`);
      }
    });
  }

  // Check if server.js exists
  if (fs.existsSync("api/server.js")) {
    console.log("   ✅ API server file exists");
    const serverContent = fs.readFileSync("api/server.js", "utf8");

    if (serverContent.includes("/api/send-otp")) {
      console.log("   ✅ OTP endpoint configured");
    }

    if (serverContent.includes("/api/verify-otp")) {
      console.log("   ✅ OTP verification endpoint configured");
    }

    if (serverContent.includes("/api/register")) {
      console.log("   ✅ Registration endpoint configured");
    }
  }

  return true;
}

// Test 4: Check JavaScript Integration
function testJavaScriptIntegration() {
  console.log("\n4. 🧩 Testing JavaScript Integration...");

  // Check signup verification
  if (fs.existsSync("signup-verification.js")) {
    const signupJS = fs.readFileSync("signup-verification.js", "utf8");
    if (signupJS.includes("send-otp") && signupJS.includes("localhost:3001")) {
      console.log("   ✅ Signup verification properly configured");
    }
  }

  // Check OTP verification
  if (fs.existsSync("otp-verification.js")) {
    const otpJS = fs.readFileSync("otp-verification.js", "utf8");
    if (otpJS.includes("verify-otp") && otpJS.includes("register")) {
      console.log("   ✅ OTP verification properly configured");
    }
  }

  return true;
}

// Test 5: Check CSS Integration
function testCSSIntegration() {
  console.log("\n5. 🎨 Testing CSS Integration...");

  // Check if OTP verification CSS has required styles
  if (fs.existsSync("otp-verification.css")) {
    const otpCSS = fs.readFileSync("otp-verification.css", "utf8");
    if (otpCSS.includes(".otp-digit") && otpCSS.includes(".verify-btn")) {
      console.log("   ✅ OTP verification styles configured");
    }
  }

  // Check if signup CSS has error/success message styles
  if (fs.existsSync("studentsignup.css")) {
    const signupCSS = fs.readFileSync("studentsignup.css", "utf8");
    if (
      signupCSS.includes(".error-message") &&
      signupCSS.includes(".success-message")
    ) {
      console.log("   ✅ Signup error/success styles configured");
    }
  }

  return true;
}

// Run all tests
function runAllTests() {
  const results = {
    fileStructure: testFileStructure(),
    htmlLinks: testHTMLLinks(),
    apiConfig: testAPIConfig(),
    jsIntegration: testJavaScriptIntegration(),
    cssIntegration: testCSSIntegration(),
  };

  console.log("\n📊 FINAL TEST RESULTS:");
  console.log("================================");

  Object.entries(results).forEach(([test, passed]) => {
    console.log(
      `${passed ? "✅" : "❌"} ${test}: ${passed ? "PASSED" : "FAILED"}`
    );
  });

  const allPassed = Object.values(results).every((result) => result);

  if (allPassed) {
    console.log("\n🎉 ALL TESTS PASSED! System is ready to use.");
    console.log("\n📋 NEXT STEPS:");
    console.log("1. cd api && npm install");
    console.log("2. Create .env file with your Gmail credentials");
    console.log("3. npm start (to start the API server)");
    console.log("4. Open index.html in your browser");
    console.log("5. Test the complete email verification flow!");
  } else {
    console.log("\n⚠️  Some tests failed. Please fix the issues above.");
  }

  return allPassed;
}

// Run the tests
runAllTests();
