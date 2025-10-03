CREATE TABLE IF NOT EXISTS "User" (
  "id"	TEXT NOT NULL PRIMARY KEY,
  "name"	TEXT,
  "avatar"	TEXT,
  "email"	TEXT,
  "password"	TEXT,
  "phoneNumber"	TEXT,
  "dateOfBirth"	TEXT,
  "doneOnboarding" BOOLEAN DEFAULT FALSE,
  "createdAt"	TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_id ON User (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_phoneNumber_unique
ON User (phoneNumber)
WHERE phoneNumber IS NOT NULL;
