// Landing page — loads and displays featured charities from the database

async function loadFeaturedCharities() {
  try {
    const response = await fetch("./charitydatabase.json");
    const charities = await response.json();

    // Show first 6 charities as featured
    const featured = charities.slice(0, 6);
    const container = document.getElementById("featuredCharities");

    featured.forEach(c => {
      const card = document.createElement("div");
      card.className = "charity-card";
      card.innerHTML = `
        <h3>${c.name}</h3>
        <p>${c.mission}</p>
        <a href="${c.url}" target="_blank" rel="noopener" class="charity-link">${c.url}</a>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Failed to load featured charities:", error);
  }
}

loadFeaturedCharities();
