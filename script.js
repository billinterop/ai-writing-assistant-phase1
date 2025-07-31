
function saveEntry() {
  const goal = document.getElementById("goal").value;
  const audience = document.getElementById("audience").value;
  const tone = document.getElementById("tone").value;
  const customTone = document.getElementById("customTone").value;

  document.getElementById("savedGoal").innerText = goal;
  document.getElementById("savedAudience").innerText = audience;
  document.getElementById("savedTone").innerText = customTone || tone;
}

document.querySelectorAll(".accordion-toggle").forEach(button => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
    const content = button.nextElementSibling;
    if (content.style.display === "block") {
      content.style.display = "none";
    } else {
      content.style.display = "block";
    }
  });
});
