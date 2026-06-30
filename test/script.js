const menu = document.getElementById("menu");
const content = document.getElementById("content");
const title = document.getElementById("menuTitle");
const wipe = document.getElementById("wipe");

const screens = {

    main: {

        title: "MAIN MENU",

        items: [
            "Item",
            "Skill",
            "Equip",
            "Persona",
            "Status"
        ]
    },

    item: {

        title: "ITEMS",

        items: [
            "Medicine",
            "Soul Drop",
            "Revive Bead",
            "Back"
        ]
    },

    equip: {

        title: "EQUIPMENT",

        items: [
            "Weapon",
            "Armor",
            "Accessory",
            "Back"
        ]
    },

    persona: {

        title: "PERSONAS",

        items: [
            "Orpheus",
            "Pixie",
            "Jack Frost",
            "Back"
        ]
    }
};

let currentScreen = "main";
let selectedIndex = 0;
const history = [];

function renderScreen() {

    menu.innerHTML = "";

    const screen = screens[currentScreen];

    title.textContent = screen.title;

    screen.items.forEach((item, index) => {

        const div =
            document.createElement("div");

        div.className = "menu-item";
        div.textContent = item;

        if(index === selectedIndex){
            div.classList.add("active");
        }

        div.addEventListener("click", () => {

            selectedIndex = index;

            renderScreen();
            activateItem();

        });

        menu.appendChild(div);
    });

    updateContent();
}

function updateContent() {

    const screen = screens[currentScreen];

    const item =
        screen.items[selectedIndex];

    content.classList.remove(
        "slide-in"
    );

    void content.offsetWidth;

    content.classList.add(
        "slide-in"
    );

    content.innerHTML = `
        <div>
            <h2>${item}</h2>
            <p>
                Selected option:
                <strong>${item}</strong>
            </p>
            <br>
            <p>
                Screen:
                ${screen.title}
            </p>
        </div>
    `;
}

function personaTransition(callback){

    wipe.animate([
        {
            clipPath:
            "polygon(0 0,0 0,0 100%,0 100%)"
        },
        {
            clipPath:
            "polygon(0 0,100% 0,100% 100%,0 100%)"
        }
    ],{
        duration:200,
        fill:"forwards"
    });

    setTimeout(()=>{

        callback();

        wipe.animate([
            {
                clipPath:
                "polygon(0 0,100% 0,100% 100%,0 100%)"
            },
            {
                clipPath:
                "polygon(100% 0,100% 0,100% 100%,100% 100%)"
            }
        ],{
            duration:200,
            fill:"forwards"
        });

    },200);
}

function openScreen(id){

    history.push(currentScreen);

    personaTransition(()=>{

        currentScreen = id;
        selectedIndex = 0;

        renderScreen();

    });
}

function goBack(){

    if(history.length === 0){
        return;
    }

    personaTransition(()=>{

        currentScreen =
            history.pop();

        selectedIndex = 0;

        renderScreen();

    });
}

function activateItem(){

    const item =
        screens[currentScreen]
        .items[selectedIndex];

    switch(item){

        case "Item":
            openScreen("item");
            return;

        case "Equip":
            openScreen("equip");
            return;

        case "Persona":
            openScreen("persona");
            return;

        case "Back":
            goBack();
            return;

        default:

            content.innerHTML = `
                <div>
                    <h2>${item}</h2>
                    <p>
                        You selected
                        ${item}
                    </p>
                </div>
            `;
    }
}

window.addEventListener(
    "keydown",
    e => {

        const items =
            screens[currentScreen]
            .items;

        if(e.key === "ArrowDown"){

            selectedIndex =
            (selectedIndex + 1)
            % items.length;

            renderScreen();
        }

        if(e.key === "ArrowUp"){

            selectedIndex =
            (selectedIndex - 1 + items.length)
            % items.length;

            renderScreen();
        }

        if(e.key === "Enter"){
            activateItem();
        }

        if(e.key === "Escape"){
            goBack();
        }

    }
);

const portrait =
document.querySelector(
    ".character-foreground"
);

const backdrop =
document.querySelector(
    ".character-backdrop"
);

document.addEventListener(
    "mousemove",
    e => {

        const x =
            (e.clientX / window.innerWidth - 0.5);

        const y =
            (e.clientY / window.innerHeight - 0.5);

        portrait.style.transform =
            `translate(${x * -15}px,
                       ${y * -15}px)`;

        backdrop.style.transform =
            `scale(1.15)
             translate(${x * -30}px,
                       ${y * -30}px)`;
    }
);

renderScreen();