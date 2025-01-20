const container = document.getElementById("shards-container");

function randomDarkColor() {
  const base = 28;
  const variation = Math.floor(Math.random() * 15);
  const value = base + variation; 
  const hex = value.toString(16).padStart(2, "0"); 
  return `#${hex}${hex}${hex}`;
}

const rows = Math.ceil(window.innerHeight / 50);
const cols = Math.ceil(window.innerWidth / 50);

// Create triangles and append to the container
for (let i = 0; i < rows * cols; i++) {
  const triangle = document.createElement("div");
  triangle.classList.add("triangle");

  const orientation = Math.random() > 0.5 ? "up" : "down";
  triangle.classList.add(orientation);

  const color = randomDarkColor();
  triangle.style.borderColor = color;

  container.appendChild(triangle);
}

// Update color on mousemove
document.addEventListener("mousemove", () => {
  const triangles = container.children;

  for (let triangle of triangles) {
    const color = randomDarkColor();
    triangle.style.borderColor = color;
  }
});
