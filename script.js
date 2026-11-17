const API_URL = "http://127.0.0.1:8080/animals";
const SESSION_URL = "http://127.0.0.1:8080/session";

let isAdmin = false;
let animals = [];
let selectedCategory = "all";
let selectedHabitat = "all";

// Images for the original animals
const animalImages = {
    tiger: "https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=700",
    elephant: "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=700",
    deer: "https://images.unsplash.com/photo-1484406566174-9da000fda645?w=700",
    leopard: "https://images.unsplash.com/photo-1567611888854-8fc5781860c8?w=700",
    lion: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=700",
    giraffe: "https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=700",
    fox: "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=700",
    bear: "https://images.unsplash.com/photo-1568162603664-fcd658421851?w=700"
};

const animalImageTitles = {
    "gaur": "Gaur", "wild boar": "Wild boar",
    "indian pangolin": "Indian pangolin", "dhole": "Dhole",
    "golden jackal": "Golden jackal", "jungle cat": "Jungle cat",
    "indian mongoose": "Indian grey mongoose",
    "indian porcupine": "Indian crested porcupine",
    "indian giant squirrel": "Indian giant squirrel",
    "bonnet macaque": "Bonnet macaque",
    "lion-tailed macaque": "Lion-tailed macaque",
    "nilgiri langur": "Nilgiri langur", "slender loris": "Slender loris",
    "barking deer": "Barking deer", "mouse deer": "Indian chevrotain",
    "four-horned antelope": "Four-horned antelope",
    "blackbuck": "Blackbuck", "striped hyena": "Striped hyena",
    "honey badger": "Honey badger", "asian palm civet": "Asian palm civet",
    "small indian civet": "Small Indian civet",
    "smooth-coated otter": "Smooth-coated otter",
    "great hornbill": "Great hornbill", "indian peafowl": "Indian peafowl",
    "king cobra": "King cobra", "indian rock python": "Indian rock python",
    "monitor lizard": "Bengal monitor",
    "indian star tortoise": "Indian star tortoise",
    "indian hare": "Indian hare"
};

function setFallbackImage(image) {
    image.onerror = null;
    image.src = "https://placehold.co/700x450/e8f0e5/28583a?text=Animal+Image";
}

async function loadAnimalImage(name, image) {
    const key = (name || "").toLowerCase().trim();
    const title = animalImageTitles[key] || name;

    try {
        const url = "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=700&redirects=1&origin=*&titles=" + encodeURIComponent(title);
        const response = await fetch(url);
        if (!response.ok) return setFallbackImage(image);

        const data = await response.json();
        const page = Object.values(data.query.pages)[0];

        if (page && page.thumbnail && page.thumbnail.source) {
            image.src = page.thumbnail.source;
            image.onerror = () => setFallbackImage(image);
        } else {
            setFallbackImage(image);
        }
    } catch (error) {
        setFallbackImage(image);
    }
}

async function checkSession() {
    try {
        const response = await fetch(SESSION_URL, {
            credentials: "include",
            cache: "no-store"
        });
        const result = await response.json();
        isAdmin = response.ok && result.authenticated === true;
    } catch (error) {
        isAdmin = false;
    }

    const addAnimal = document.getElementById("add-animal");
    const addLink = document.getElementById("addLink");
    const loginLink = document.getElementById("loginLink");
    const logoutButton = document.getElementById("logoutButton");

    if (addAnimal) addAnimal.style.display = isAdmin ? "block" : "none";
    if (addLink) addLink.style.display = isAdmin ? "inline-block" : "none";
    if (loginLink) loginLink.style.display = isAdmin ? "none" : "inline-block";
    if (logoutButton) logoutButton.style.display = isAdmin ? "inline-block" : "none";
}

async function loadAnimals() {
    const container = document.getElementById("animalData");

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Could not load animals");

        animals = await response.json();
        populateHabitatFilter();
        applyAnimalFilters();
        displayEndangeredAnimals();
    } catch (error) {
        if (container) container.innerHTML = "<p>Unable to load animal information. Check that Java backend and MySQL are running.</p>";
        const endangered = document.getElementById("endangeredData");
        if (endangered) endangered.innerHTML = "<p>Conservation information is not available right now.</p>";
    }
}

function createAnimalCard(animal) {
    const card = document.createElement("article");
    card.className = "animal-card";

    const image = document.createElement("img");
    image.alt = (animal.name || "Animal") + " photograph";
    image.className = "animal-image";
    image.loading = "lazy";

    const key = (animal.name || "").toLowerCase().trim();
    if (animalImages[key]) {
        image.src = animalImages[key];
        image.onerror = function () { setFallbackImage(this); };
    } else {
        image.src = "https://placehold.co/700x450/e8f0e5/28583a?text=Loading...";
        loadAnimalImage(animal.name, image);
    }

    const details = document.createElement("div");
    details.className = "animal-details";

    const heading = document.createElement("h3");
    heading.textContent = animal.name || "Unknown animal";
    details.appendChild(heading);

    const fields = [
        ["Species", animal.species],
        ["Habitat", animal.habitat],
        ["Food Habit", animal.food_habit],
        ["Conservation Status", animal.conservation_status],
        ["Description", animal.description]
    ];

    fields.forEach(([label, value]) => {
        const paragraph = document.createElement("p");
        const strong = document.createElement("strong");
        strong.textContent = label + ": ";
        paragraph.appendChild(strong);
        paragraph.appendChild(document.createTextNode(value || "Not available"));
        details.appendChild(paragraph);
    });

    card.appendChild(image);
    card.appendChild(details);

    if (isAdmin) {
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.className = "edit-button";
        editButton.onclick = () => editAnimal(animal.id);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-button";
        deleteButton.onclick = () => deleteAnimal(animal.id);

        card.appendChild(editButton);
        card.appendChild(deleteButton);
    }

    return card;
}

function displayAnimals(list, targetId = "animalData") {
    const container = document.getElementById(targetId);
    if (!container) return;

    container.innerHTML = "";
    if (!list || list.length === 0) {
        container.innerHTML = "<p class='empty-message'>No animals found for this selection.</p>";
        return;
    }

    list.forEach(animal => container.appendChild(createAnimalCard(animal)));
}

function getAnimalCategory(animal) {
    const value = ((animal.name || "") + " " + (animal.species || "")).toLowerCase();

    if (/bird|eagle|owl|parrot|hornbill|peafowl|peacock|vulture|woodpecker|kingfisher/.test(value)) return "bird";
    if (/snake|cobra|python|lizard|monitor|tortoise|turtle|crocodile|reptile/.test(value)) return "reptile";
    if (/fish|otter|dolphin|whale|aquatic|water/.test(value)) return "aquatic";
    return "mammal";
}

function applyAnimalFilters() {
    const searchBox = document.getElementById("search");
    const searchValue = searchBox ? searchBox.value.toLowerCase().trim() : "";

    const filtered = animals.filter(animal => {
        const name = (animal.name || "").toLowerCase();
        const species = (animal.species || "").toLowerCase();
        const habitat = (animal.habitat || "").toLowerCase();

        const matchesSearch = name.includes(searchValue) || species.includes(searchValue);
        const matchesCategory = selectedCategory === "all" || getAnimalCategory(animal) === selectedCategory;
        const matchesHabitat = selectedHabitat === "all" || habitat === selectedHabitat.toLowerCase();

        return matchesSearch && matchesCategory && matchesHabitat;
    });

    displayAnimals(filtered);
    const count = document.getElementById("resultCount");
    if (count) count.textContent = "Showing " + filtered.length + " of " + animals.length + " animals";
}

function searchAnimals() {
    applyAnimalFilters();
}

function populateHabitatFilter() {
    const select = document.getElementById("habitatFilter");
    if (!select) return;

    const currentValue = selectedHabitat;
    const habitats = [...new Set(animals.map(a => (a.habitat || "").trim()).filter(Boolean))];

    select.innerHTML = '<option value="all">All habitats</option>';
    habitats.sort((a, b) => a.localeCompare(b)).forEach(habitat => {
        const option = document.createElement("option");
        option.value = habitat;
        option.textContent = habitat;
        select.appendChild(option);
    });

    if ([...select.options].some(option => option.value.toLowerCase() === currentValue.toLowerCase())) {
        select.value = currentValue;
    } else {
        selectedHabitat = "all";
        select.value = "all";
    }
}

function displayEndangeredAnimals() {
    const endangered = animals.filter(animal => {
        const status = (animal.conservation_status || "").toLowerCase();
        return status.includes("endangered") || status.includes("critically endangered");
    });

    displayAnimals(endangered, "endangeredData");
}

async function addAnimal(event) {
    event.preventDefault();

    const form = document.getElementById("animalForm");
    const formData = new FormData(form);
    const data = new URLSearchParams();

    for (const [key, value] of formData.entries()) data.append(key, value);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: data.toString()
        });

        const result = await response.text();
        if (!response.ok) {
            alert("Add animal failed: " + result);
            return;
        }

        alert("Animal added successfully!");
        form.reset();
        await loadAnimals();
    } catch (error) {
        alert("Backend connection failed: " + error.message);
    }
}

async function editAnimal(id) {
    const animal = animals.find(item => String(item.id) === String(id));
    if (!animal) return;

    const name = prompt("Enter animal name:", animal.name);
    if (name === null) return;
    const species = prompt("Enter species:", animal.species);
    if (species === null) return;
    const habitat = prompt("Enter habitat:", animal.habitat);
    if (habitat === null) return;
    const food = prompt("Enter food habit:", animal.food_habit);
    if (food === null) return;
    const status = prompt("Enter conservation status:", animal.conservation_status);
    if (status === null) return;
    const description = prompt("Enter description:", animal.description);
    if (description === null) return;

    const data = new URLSearchParams({
        id: String(id), name, species, habitat,
        food_habit: food, conservation_status: status, description
    });

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: data.toString()
        });

        const result = await response.text();
        if (!response.ok) {
            alert("Edit failed: " + result);
            return;
        }

        alert("Animal updated successfully!");
        await loadAnimals();
    } catch (error) {
        alert("Backend connection failed: " + error.message);
    }
}

async function deleteAnimal(id) {
    if (!confirm("Are you sure you want to delete this animal?")) return;

    const data = new URLSearchParams({ id: String(id) });
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "DELETE",
            credentials: "include",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: data.toString()
        });

        const result = await response.text();
        if (!response.ok) {
            alert("Delete failed: " + result);
            return;
        }

        alert("Animal deleted successfully!");
        await loadAnimals();
    } catch (error) {
        alert("Backend connection failed: " + error.message);
    }
}

async function logout() {
    try {
        const response = await fetch("http://127.0.0.1:8080/logout", {
            method: "POST",
            credentials: "include"
        });

        if (!response.ok) {
            alert("Logout failed");
            return;
        }

        window.location.href = "index.html";
    } catch (error) {
        alert("Logout failed: " + error.message);
    }
}

// Simple educational wildlife quiz
const quizQuestions = [
    { question: "Which animal is known as the largest land animal?", options: ["Tiger", "Elephant", "Deer", "Fox"], answer: 1 },
    { question: "What do herbivores mainly eat?", options: ["Plants", "Meat", "Only insects", "Stone"], answer: 0 },
    { question: "Which of these is a reptile?", options: ["Giraffe", "Bear", "King cobra", "Deer"], answer: 2 },
    { question: "What is a natural habitat?", options: ["A shopping mall", "The place an animal lives", "A classroom", "A vehicle"], answer: 1 },
    { question: "Which action helps protect wildlife?", options: ["Throwing plastic in rivers", "Disturbing nests", "Protecting forests", "Feeding wild animals by hand"], answer: 2 }
];

let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

function renderQuiz() {
    const questionElement = document.getElementById("quizQuestion");
    const optionsElement = document.getElementById("quizOptions");
    const feedback = document.getElementById("quizFeedback");
    const nextButton = document.getElementById("nextQuestion");
    const restartButton = document.getElementById("restartQuiz");
    const progress = document.getElementById("quizProgress");
    const score = document.getElementById("quizScore");

    if (!questionElement || !optionsElement) return;

    if (quizIndex >= quizQuestions.length) {
        questionElement.textContent = "Quiz completed!";
        optionsElement.innerHTML = "";
        feedback.textContent = "Your final score is " + quizScore + " out of " + quizQuestions.length + ".";
        progress.textContent = "Completed";
        score.textContent = "Score: " + quizScore;
        nextButton.hidden = true;
        restartButton.hidden = false;
        return;
    }

    const current = quizQuestions[quizIndex];
    questionElement.textContent = current.question;
    optionsElement.innerHTML = "";
    feedback.textContent = "";
    progress.textContent = "Question " + (quizIndex + 1) + " of " + quizQuestions.length;
    score.textContent = "Score: " + quizScore;
    nextButton.disabled = true;
    nextButton.hidden = false;
    restartButton.hidden = true;
    quizAnswered = false;

    current.options.forEach((option, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "quiz-option";
        button.textContent = option;
        button.addEventListener("click", () => chooseQuizAnswer(index));
        optionsElement.appendChild(button);
    });
}

function chooseQuizAnswer(selectedIndex) {
    if (quizAnswered) return;
    quizAnswered = true;

    const current = quizQuestions[quizIndex];
    const buttons = document.querySelectorAll(".quiz-option");
    buttons.forEach((button, index) => {
        button.disabled = true;
        if (index === current.answer) button.classList.add("correct-answer");
        if (index === selectedIndex && index !== current.answer) button.classList.add("wrong-answer");
    });

    const feedback = document.getElementById("quizFeedback");
    if (selectedIndex === current.answer) {
        quizScore++;
        feedback.textContent = "Correct! Well done.";
    } else {
        feedback.textContent = "Not quite. The correct answer is " + current.options[current.answer] + ".";
    }

    document.getElementById("quizScore").textContent = "Score: " + quizScore;
    document.getElementById("nextQuestion").disabled = false;
}

function startWebsite() {
    const searchBox = document.getElementById("search");
    if (searchBox) searchBox.addEventListener("input", searchAnimals);

    const habitatFilter = document.getElementById("habitatFilter");
    if (habitatFilter) {
        habitatFilter.addEventListener("change", () => {
            selectedHabitat = habitatFilter.value;
            applyAnimalFilters();
        });
    }

    document.querySelectorAll("[data-category]").forEach(button => {
        button.addEventListener("click", () => {
            selectedCategory = button.dataset.category;
            document.querySelectorAll("[data-category]").forEach(item => item.classList.remove("active-category"));
            button.classList.add("active-category");
            applyAnimalFilters();
            document.getElementById("animals").scrollIntoView({ behavior: "smooth" });
        });
    });

    const clearFilters = document.getElementById("clearFilters");
    if (clearFilters) {
        clearFilters.addEventListener("click", () => {
            selectedCategory = "all";
            selectedHabitat = "all";
            if (searchBox) searchBox.value = "";
            if (habitatFilter) habitatFilter.value = "all";
            document.querySelectorAll("[data-category]").forEach(item => item.classList.remove("active-category"));
            const allButton = document.querySelector('[data-category="all"]');
            if (allButton) allButton.classList.add("active-category");
            applyAnimalFilters();
        });
    }

    const form = document.getElementById("animalForm");
    if (form) form.addEventListener("submit", addAnimal);

    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) logoutButton.addEventListener("click", logout);

    const nextButton = document.getElementById("nextQuestion");
    if (nextButton) {
        nextButton.addEventListener("click", () => {
            if (!nextButton.disabled) {
                quizIndex++;
                renderQuiz();
            }
        });
    }

    const restartButton = document.getElementById("restartQuiz");
    if (restartButton) {
        restartButton.addEventListener("click", () => {
            quizIndex = 0;
            quizScore = 0;
            renderQuiz();
        });
    }

    renderQuiz();
    checkSession().then(loadAnimals);
}

document.addEventListener("DOMContentLoaded", startWebsite);
