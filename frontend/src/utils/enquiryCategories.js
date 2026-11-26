// Mirrors backend/app/core/enquiry_categories.py. The backend enforces visibility; this only shapes the UI.
export const ENQUIRY_CATEGORIES = ["Vehicle/Price", "Finance", "Service", "General"];

const ROLE_CATEGORIES = {
  sales_executive: ["Vehicle/Price", "Finance"],
  receptionist: ["Service", "General"],
};

export function categoriesFor(user) {
  if (user?.role === "manager") return ENQUIRY_CATEGORIES;
  return ROLE_CATEGORIES[user?.role] || [];
}

export function canSeeCategory(user, category, assignedTo) {
  return user?.role === "manager" || assignedTo === user?.user_id || categoriesFor(user).includes(category);
}
