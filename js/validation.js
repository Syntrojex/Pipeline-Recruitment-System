/* ================================================================
   Form validation used by the Add-candidate and Detail modals.
   Same rules as before, just written as plain if-checks.
   ================================================================ */

function validateCandidate(data) {
  const errors = {};

  if (!Number.isFinite(data.id) || !Number.isInteger(data.id) || data.id <= 0) {
    errors.id = "Must be a positive whole number.";
  }
  if (!data.name) {
    errors.name = "Name is required.";
  }
  if (!data.university) {
    errors.university = "University is required.";
  }
  if (!Number.isFinite(data.experience) || data.experience < 0) {
    errors.experience = "Must be 0 or more.";
  }
  if (!Number.isFinite(data.cgpa) || data.cgpa < 0 || data.cgpa > 4) {
    errors.cgpa = "CGPA must be between 0.0 and 4.0.";
  }
  if (!Number.isFinite(data.technicalScore) || data.technicalScore < 0 || data.technicalScore > 100) {
    errors.technicalScore = "Must be between 0 and 100.";
  }
  if (!Number.isFinite(data.interviewScore) || data.interviewScore < 0 || data.interviewScore > 100) {
    errors.interviewScore = "Must be between 0 and 100.";
  }

  return errors;
}

function validateScore(score) {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return "Must be between 0 and 100.";
  }
  return null;
}
