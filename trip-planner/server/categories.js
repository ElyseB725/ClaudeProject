// Fixed list of activity categories, per the requirements document — no AI call needed,
// this never changes. Places may belong to one or more of these.
const CATEGORIES = [
  { id: "monuments", label: "Monuments" },
  { id: "musees-art", label: "Museums & Art" },
  { id: "nature-balade", label: "Nature & Walks" },
  { id: "artisanat-local", label: "Local Crafts" },
  { id: "restaurants", label: "Restaurants" },
  { id: "bars", label: "Bars" },
  { id: "spectacles", label: "Shows" },
];

// Cross-cutting tag: a place can be kid-friendly IN ADDITION to its normal category/categories,
// it is never itself one of the CATEGORIES above.
const KIDS_TAG = { id: "enfants", label: "Kid-friendly" };

module.exports = { CATEGORIES, KIDS_TAG };
