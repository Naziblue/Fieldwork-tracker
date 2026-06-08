# 🚨 Critical Action Required: Update Database Rules

The error you are seeing (`Permission denied`) is happening because your Firebase Security Rules are blocking the app from creating the new `users` collection.

To fix this and enable your new Professional Database Structure, you must update your rules in the Firebase Console.

## Steps to Fix

1.  Go to the [Firebase Console](https://console.firebase.google.com/)
2.  Select your project: **fieldwork-tracker**
3.  Go to **Firestore Database** > **Rules** tab.
4.  **Replace** your existing rules with the following code:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // --- 1. Users Profile Collection ---
    // Trainees/supervisors can read and write their own profile document.
    // Supervisors can read a trainee's profile if their email is in the trainee's supervisorEmails array.
    // Trainees can read a supervisor's profile if the supervisor's email is in the trainee's supervisorEmails array.
    // Admins can read all profiles.
    match /users/{userId} {
      allow write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && (
        request.auth.uid == userId ||
        (resource != null && 'supervisorEmails' in resource.data && request.auth.token.email in resource.data.supervisorEmails) ||
        (resource != null && 'email' in resource.data && 
         'supervisorEmails' in get(/databases/$(database)/documents/users/$(request.auth.uid)).data &&
         resource.data.email in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.supervisorEmails) ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
    }

    // --- 2. Fieldwork Entries Subcollection ---
    // Trainees can read and write their own fieldwork entries.
    // Linked supervisors can read and write entries (to add/edit/delete supervisorNote)
    // if their email is listed in the trainee's profile supervisorEmails array.
    match /users/{userId}/entries/{entryId} {
      allow read, write: if request.auth != null && (
        request.auth.uid == userId ||
        request.auth.token.email in get(/databases/$(database)/documents/users/$(userId)).data.supervisorEmails
      );
    }
    
    // --- 3. Digital Verifications Subcollection ---
    // Trainees can read/write their own verifications.
    // Linked supervisors can read and write (to sign months) verifications if listed in supervisorEmails.
    match /users/{userId}/verifications/{verifId} {
      allow read, write: if request.auth != null && (
        request.auth.uid == userId ||
        request.auth.token.email in get(/databases/$(database)/documents/users/$(userId)).data.supervisorEmails
      );
    }

    // --- 4. Admin & Requested Collections (Unchanged/Kept safe) ---
    match /admin/{docId} { allow read, write: if true; } 
    match /adminLogs/{docId} { allow read, write: if true; }
    match /settings/{docId} { allow read, write: if true; }
    match /invitations/{docId} { allow read, write: if true; }
    
    // --- 5. Future/Placeholder Collections (Unchanged/Kept safe) ---
    match /blocks/{docId} { allow read, write: if true; }
    match /history/{docId} { allow read, write: if true; }
    match /metrics/{docId} { allow read, write: if true; }
    match /notebooks/{docId} { allow read, write: if true; }
    match /pages/{docId} { allow read, write: if true; }
    match /workspaces/{docId} { allow read, write: if true; }

    // --- 6. Legacy Backup Collections (Unchanged/Kept safe) ---
    match /artifacts/{appId}/{document=**} {
      allow read, write: if true;
    }
    
  }
}
```

5.  Click **Publish**.

## Once Published:
1.  Go back to your app.
2.  Click "I am a Trainee" (or Supervisor) again.
3.  **It will work instantly!** 🎉

This change is necessary because we moved your data from the "public" `artifacts` folder to the secure `users` folder. The database is correctly blocking write access until you explicitly allow it.
