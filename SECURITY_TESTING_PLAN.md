# API Security Testing Plan

This document outlines the manual tests to verify that the API security vulnerabilities have been fixed. Run these tests from your browser's developer console while the POS application is running.

## Test 1: Access without Session Header

**Objective:** Ensure that API endpoints are protected and return a `401 Unauthorized` error when the `x-pos-session` header is missing.

**Instructions:**

1.  Open the POS application in your browser and log in.
2.  Open the developer console (Right-click -> Inspect -> Console).
3.  Run the following `fetch` command to try and delete a category without a session header. Replace `'any-category-id'` with a real category ID from your database if you wish, though it should fail before the ID is even checked.

```javascript
// Test DELETE without session header
await fetch('/api/categories/any-category-id', {
  method: 'DELETE'
});
```

**Expected Result:**

The console should show a `Response` object with `status: 401` and `ok: false`. The response body should contain an error message like `{"error":"Unauthorized - Invalid or missing session"}`.

---

## Test 2: Access with Invalid Session

**Objective:** Ensure the API rejects requests with a malformed or invalid session.

**Instructions:**

1.  In the developer console, run the following command, which uses a fake session string.

```javascript
// Test with a fake session
await fetch('/api/categories/any-category-id', {
  method: 'DELETE',
  headers: {
    'x-pos-session': '{"user_id":"fake-user","org_id":"fake-org"}'
  }
});
```

**Expected Result:**

The API should return a `401 Unauthorized` response, as the session is not valid.

---

## Test 3: Access with Valid Session (Normal App Usage)

**Objective:** Confirm that the application works as expected for authenticated users.

**Instructions:**

1.  Use the POS application normally.
2.  Perform the following actions:
    *   Create a new category.
    *   Edit an existing item.
    *   Delete a category.
    *   Add a new modifier group.

**Expected Result:**

All operations should succeed without any errors. The UI should update correctly, and you should see the changes reflected in the application.

---

## Test 4: Cross-Organization Access

**Objective:** Verify that a user from one organization cannot access or modify data belonging to another organization.

**Prerequisites:**

*   You need two organizations in your database, let's call them **Org A** and **Org B**.
*   You need a user who belongs to **Org A**.
*   You need the ID of a resource that belongs to **Org B** (e.g., a category ID).

**Instructions:**

1.  Log in to the POS application as the user from **Org A**.
2.  Open the developer console and get the current session data:

    ```javascript
    const session = sessionStorage.getItem('pos_session');
    console.log(session);
    ```

3.  Copy the logged session string.
4.  Get the ID of a category that belongs to **Org B**. Let's say the ID is `'category-from-org-b'`.
5.  Use the session from **Org A** to try and delete the category from **Org B**:

    ```javascript
    const orgASession = 'PASTE_YOUR_SESSION_STRING_HERE';
    const orgBCategoryId = 'ID_OF_CATEGORY_IN_ORG_B';

    await fetch(`/api/categories/${orgBCategoryId}`, {
      method: 'DELETE',
      headers: {
        'x-pos-session': orgASession
      }
    });
    ```

**Expected Result:**

The request should fail with a `403 Forbidden` or `404 Not Found` status code. This confirms that the API is correctly preventing cross-organization access.
