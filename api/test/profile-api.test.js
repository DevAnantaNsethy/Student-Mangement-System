/**
 * Student Profile API Tests
 * Tests for profile management endpoints with offline sync capabilities
 */

const request = require('supertest');
const mongoose = require('mongoose');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Import the app (adjust path if needed)
const app = require('./unified-server.js');

describe('Student Profile API', () => {
  let testUser;
  let authToken;
  let server;

  beforeAll(async () => {
    // Start the server for testing
    server = app.listen(0); // Use random available port

    // Connect to test database
    const testMongoUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/student-management-test';
    await mongoose.connect(testMongoUri);

    // Create test user
    const testUserData = {
      name: 'Test Student',
      email: 'teststudent@example.com',
      password: 'password123',
      role: 'student',
      verified: true
    };

    // Register test user
    const registerResponse = await request(app)
      .post('/api/register')
      .send(testUserData);

    expect(registerResponse.status).toBe(200);
    testUser = registerResponse.body.user;

    // Login to get session
    const loginResponse = await request(app)
      .post('/api/login')
      .send({
        email: testUserData.email,
        password: testUserData.password
      });

    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.user;
  });

  afterAll(async () => {
    // Clean up test data
    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('users').deleteMany({ email: 'teststudent@example.com' });
      await mongoose.connection.db.collection('studentdatas').deleteMany({ studentId: testUser.id });
    }

    await mongoose.connection.close();
    server.close();
  });

  describe('POST /api/student/profile', () => {
    it('should create a new student profile successfully', async () => {
      const formData = new FormData();
      formData.append('studentId', testUser.id);
      formData.append('personalInfo', JSON.stringify({
        fullName: 'Test Student',
        age: 20,
        gender: 'Male',
        email: 'teststudent@example.com',
        phone: '+1234567890',
        whatsapp: '+1234567890'
      }));
      formData.append('academicInfo', JSON.stringify({
        registrationNo: 'REG2024001',
        branch: 'CSE',
        yearOfStudy: 2,
        section: 'A'
      }));
      formData.append('professionalInfo', JSON.stringify({
        role: 'Developer',
        skills: 'JavaScript, Node.js, React'
      }));

      const response = await request(app)
        .post('/api/student/profile')
        .set('Content-Type', 'multipart/form-data')
        .send(formData.getBuffer());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile saved successfully');
      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.personalInfo.fullName).toBe('Test Student');
      expect(response.body.profile.academicInfo.registrationNo).toBe('REG2024001');
    });

    it('should validate required personal information fields', async () => {
      const formData = new FormData();
      formData.append('studentId', testUser.id);
      formData.append('personalInfo', JSON.stringify({
        fullName: '', // Missing required field
        age: 20,
        gender: 'Male',
        email: 'teststudent@example.com',
        phone: '+1234567890',
        whatsapp: '+1234567890'
      }));
      formData.append('academicInfo', JSON.stringify({
        registrationNo: 'REG2024001',
        branch: 'CSE',
        yearOfStudy: 2,
        section: 'A'
      }));

      const response = await request(app)
        .post('/api/student/profile')
        .set('Content-Type', 'multipart/form-data')
        .send(formData.getBuffer());

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });

    it('should validate required academic information fields', async () => {
      const formData = new FormData();
      formData.append('studentId', testUser.id);
      formData.append('personalInfo', JSON.stringify({
        fullName: 'Test Student',
        age: 20,
        gender: 'Male',
        email: 'teststudent@example.com',
        phone: '+1234567890',
        whatsapp: '+1234567890'
      }));
      formData.append('academicInfo', JSON.stringify({
        registrationNo: '', // Missing required field
        branch: 'CSE',
        yearOfStudy: 2,
        section: 'A'
      }));

      const response = await request(app)
        .post('/api/student/profile')
        .set('Content-Type', 'multipart/form-data')
        .send(formData.getBuffer());

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });

    it('should handle profile picture upload', async () => {
      // Create a test image file
      const testImagePath = path.join(__dirname, 'test-image.jpg');
      fs.writeFileSync(testImagePath, Buffer.from('fake-image-data'));

      const formData = new FormData();
      formData.append('studentId', testUser.id);
      formData.append('personalInfo', JSON.stringify({
        fullName: 'Test Student with Image',
        age: 21,
        gender: 'Female',
        email: 'teststudent@example.com',
        phone: '+1234567890',
        whatsapp: '+1234567890'
      }));
      formData.append('academicInfo', JSON.stringify({
        registrationNo: 'REG2024002',
        branch: 'ME',
        yearOfStudy: 3,
        section: 'B'
      }));
      formData.append('profilePicture', fs.createReadStream(testImagePath), 'profile.jpg');

      const response = await request(app)
        .post('/api/student/profile')
        .set('Content-Type', 'multipart/form-data')
        .send(formData.getBuffer());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.profile.personalInfo.profilePicture).toBeDefined();

      // Clean up test file
      fs.unlinkSync(testImagePath);
    });

    it('should update existing profile (upsert behavior)', async () => {
      const formData = new FormData();
      formData.append('studentId', testUser.id);
      formData.append('personalInfo', JSON.stringify({
        fullName: 'Updated Test Student',
        age: 22,
        gender: 'Other',
        email: 'teststudent@example.com',
        phone: '+0987654321',
        whatsapp: '+0987654321'
      }));
      formData.append('academicInfo', JSON.stringify({
        registrationNo: 'REG2024001',
        branch: 'ECE',
        yearOfStudy: 4,
        section: 'C'
      }));

      const response = await request(app)
        .post('/api/student/profile')
        .set('Content-Type', 'multipart/form-data')
        .send(formData.getBuffer());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.profile.personalInfo.fullName).toBe('Updated Test Student');
      expect(response.body.profile.academicInfo.branch).toBe('ECE');
    });
  });

  describe('GET /api/student/profile/:studentId', () => {
    it('should retrieve existing student profile', async () => {
      const response = await request(app)
        .get(`/api/student/profile/${testUser.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.personalInfo.fullName).toBe('Updated Test Student');
    });

    it('should return 404 for non-existent profile', async () => {
      const fakeUserId = '507f1f77bcf86cd799439011'; // Fake ObjectId
      const response = await request(app)
        .get(`/api/student/profile/${fakeUserId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Profile not found');
    });
  });

  describe('GET /api/student/profile-status/:studentId', () => {
    it('should return profile completion status', async () => {
      const response = await request(app)
        .get(`/api/student/profile-status/${testUser.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.isComplete).toBe(true);
      expect(response.body.profile).toBeDefined();
    });

    it('should return false for incomplete profile', async () => {
      // Create a user without profile
      const incompleteUserResponse = await request(app)
        .post('/api/register')
        .send({
          name: 'Incomplete User',
          email: 'incomplete@example.com',
          password: 'password123',
          confirmPassword: 'password123'
        });

      const incompleteUser = incompleteUserResponse.body.user;

      const response = await request(app)
        .get(`/api/student/profile-status/${incompleteUser.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.isComplete).toBe(false);
      expect(response.body.profile).toBeNull();

      // Clean up
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection('users').deleteMany({ email: 'incomplete@example.com' });
      }
    });
  });

  describe('PUT /api/student/profile/:studentId', () => {
    it('should update existing student profile', async () => {
      const formData = new FormData();
      formData.append('personalInfo', JSON.stringify({
        fullName: 'Final Updated Student',
        age: 23,
        gender: 'Female',
        email: 'teststudent@example.com',
        phone: '+1111111111',
        whatsapp: '+1111111111'
      }));
      formData.append('academicInfo', JSON.stringify({
        registrationNo: 'REG2024001',
        branch: 'EE',
        yearOfStudy: 4,
        section: 'D'
      }));
      formData.append('professionalInfo', JSON.stringify({
        role: 'Frontend Designer',
        skills: 'HTML, CSS, JavaScript, React'
      }));

      const response = await request(app)
        .put(`/api/student/profile/${testUser.id}`)
        .set('Content-Type', 'multipart/form-data')
        .send(formData.getBuffer());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
    });

    it('should return 404 when updating non-existent profile', async () => {
      const fakeUserId = '507f1f77bcf86cd799439011'; // Fake ObjectId
      const formData = new FormData();
      formData.append('personalInfo', JSON.stringify({
        fullName: 'Non-existent',
        age: 20,
        gender: 'Male',
        email: 'nonexistent@example.com',
        phone: '+1234567890',
        whatsapp: '+1234567890'
      }));

      const response = await request(app)
        .put(`/api/student/profile/${fakeUserId}`)
        .set('Content-Type', 'multipart/form-data')
        .send(formData.getBuffer());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Profile not found');
    });
  });

  describe('File Upload Validation', () => {
    it('should reject invalid file types for profile picture', async () => {
      // Create a test file with invalid extension
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, Buffer.from('test-file-content'));

      const formData = new FormData();
      formData.append('studentId', testUser.id);
      formData.append('personalInfo', JSON.stringify({
        fullName: 'Test Student',
        age: 20,
        gender: 'Male',
        email: 'teststudent@example.com',
        phone: '+1234567890',
        whatsapp: '+1234567890'
      }));
      formData.append('academicInfo', JSON.stringify({
        registrationNo: 'REG2024003',
        branch: 'Civil',
        yearOfStudy: 1,
        section: 'A'
      }));
      formData.append('profilePicture', fs.createReadStream(testFilePath), 'test.txt');

      const response = await request(app)
        .post('/api/student/profile')
        .set('Content-Type', 'multipart/form-data')
        .send(formData.getBuffer());

      expect(response.status).toBe(500); // Should fail due to file validation

      // Clean up test file
      fs.unlinkSync(testFilePath);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON data gracefully', async () => {
      const formData = new FormData();
      formData.append('studentId', testUser.id);
      formData.append('personalInfo', 'invalid-json-data');
      formData.append('academicInfo', JSON.stringify({
        registrationNo: 'REG2024004',
        branch: 'CSE',
        yearOfStudy: 2,
        section: 'A'
      }));

      const response = await request(app)
        .post('/api/student/profile')
        .set('Content-Type', 'multipart/form-data')
        .send(formData.getBuffer());

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle missing studentId', async () => {
      const formData = new FormData();
      formData.append('personalInfo', JSON.stringify({
        fullName: 'Test Student',
        age: 20,
        gender: 'Male',
        email: 'teststudent@example.com',
        phone: '+1234567890',
        whatsapp: '+1234567890'
      }));
      formData.append('academicInfo', JSON.stringify({
        registrationNo: 'REG2024005',
        branch: 'CSE',
        yearOfStudy: 2,
        section: 'A'
      }));

      const response = await request(app)
        .post('/api/student/profile')
        .set('Content-Type', 'multipart/form-data')
        .send(formData.getBuffer());

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Student ID is required');
    });
  });
});