document.getElementById('openEditor').onclick = () => {
    window.location.href = "../editor/Editor.html";
};

const titles = [
    "Where Bad Ideas Survive",
    "Welcome to the Swarm",
    "Probably Fine",
    "Ongoing Experiment",
    "Do Not Touch",
    "Unstable by Design",
    "Containment Failed",
    "Active Infestation",
    "Ideas Left Unattended",
    "This Was a Mistake",
    "Handle With Gloves",
    "Untested and Confident",
    "Please Advise",
    "Improvised Solutions",
    "No Warranty Implied",
    "Experimental Build",
    "Still in Development",
    "Known Side Effects",
    "Not FDA Approved",
    "Unsupervised",
    "Proceed Anyway",
    "Ideas Escaped",
    "Temporary Measures",
    "Questionable Decisions",
    "Lab Notes Missing",
    "Unexpected Results",
    "Nothing Is On Fire",
    "Barely Contained",
    "Probably Safe",
    "Results May Vary"
];

document.title = titles[Math.floor(Math.random() * titles.length)];
