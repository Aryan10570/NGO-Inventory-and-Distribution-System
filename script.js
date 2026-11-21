let donations = JSON.parse(localStorage.getItem("donations")) || [];
let requests = JSON.parse(localStorage.getItem("requests")) || [];
let distributions = JSON.parse(localStorage.getItem("distributions")) || [];

const $ = id => document.getElementById(id);

function saveData() {
    localStorage.setItem("donations", JSON.stringify(donations));
    localStorage.setItem("requests", JSON.stringify(requests));
    localStorage.setItem("distributions", JSON.stringify(distributions));
}

function clean(text) {
    return String(text).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function validQuantity(value) {
    return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function makeId() {
    return Date.now().toString() + Math.random().toString(36).slice(2);
}

// Add a new donation
$("donationForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const donor = $("donor").value.trim();
    const name = $("itemName").value.trim();
    const category = $("category").value;
    const quantity = Number($("quantity").value);
    const condition = $("condition").value;

    if (!donor || !name || !category || !condition ||
        !validQuantity(quantity)) {
        alert("Please enter valid donation details.");
        return;
    }

    donations.push({
        id: makeId(),
        donor,
        name,
        category,
        quantity,
        condition
    });

    saveData();
    this.reset();
    renderAll();
    alert("Donation added successfully!");
});

// Add a recipient requirement
$("requestForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const recipient = $("recipientName").value.trim();
    const category = $("requiredCategory").value;
    const item = $("requiredItem").value.trim();
    const quantity = Number($("requiredQuantity").value);

    if (!recipient || !category || !item || !validQuantity(quantity)) {
        alert("Please enter valid requirement details.");
        return;
    }

    requests.push({
        id: makeId(),
        recipient,
        category,
        item,
        quantity,
        allocated: 0,
        status: "Pending"
    });

    saveData();
    this.reset();
    renderAll();
    alert("Recipient requirement added!");
});

// Allocate an item to a recipient
$("allocationForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const request = requests.find(
        r => r.id === $("requestSelect").value
    );

    const donation = donations.find(
        d => d.id === $("inventorySelect").value
    );

    const quantity = Number($("allocationQuantity").value);

    if (!request || !donation || !validQuantity(quantity)) {
        alert("Please select a valid request and item.");
        return;
    }

    if (request.status === "Distributed") {
        alert("This request has already been completed.");
        return;
    }

    if (
        request.category !== donation.category ||
        request.item.trim().toLowerCase() !==
        donation.name.trim().toLowerCase()
    ) {
        alert("Please select the item required by this recipient.");
        return;
    }

    const remaining = request.quantity - request.allocated;

    if (quantity > donation.quantity) {
        alert("Not enough items available in inventory.");
        return;
    }

    if (quantity > remaining) {
        alert("Required quantity remaining: " + remaining);
        return;
    }

    donation.quantity -= quantity;
    request.allocated += quantity;

    request.status = request.allocated === request.quantity
        ? "Allocated"
        : "Partially Allocated";

    distributions.push({
        id: makeId(),
        requestId: request.id,
        donationId: donation.id,
        recipient: request.recipient,
        item: donation.name,
        quantity,
        status: "Allocated",
        date: new Date().toLocaleDateString()
    });

    saveData();
    this.reset();
    renderAll();
    alert("Item allocated successfully!");
});

// Mark allocated items as distributed
function markDistributed(id) {
    const record = distributions.find(d => d.id === id);

    if (!record || record.status !== "Allocated") {
        return;
    }

    record.status = "Distributed";

    const request = requests.find(r => r.id === record.requestId);

    if (request) {
        const requestRecords = distributions.filter(
            d => d.requestId === request.id
        );

        const allDistributed = requestRecords.every(
            d => d.status === "Distributed"
        );

        request.status = allDistributed &&
            request.allocated === request.quantity
            ? "Distributed"
            : request.allocated === request.quantity
                ? "Allocated"
                : "Partially Allocated";
    }

    saveData();
    renderAll();
    alert("Distribution status updated!");
}

// Show inventory
function renderInventory() {
    const search = $("search").value.trim().toLowerCase();

    const filtered = donations.filter(d =>
        d.quantity > 0 &&
        (d.name.toLowerCase().includes(search) ||
         d.category.toLowerCase().includes(search))
    );

    $("inventoryTable").innerHTML = filtered.map(d => `
        <tr>
            <td>${clean(d.name)}</td>
            <td>${clean(d.category)}</td>
            <td>${d.quantity}</td>
            <td>${clean(d.condition)}</td>
            <td>
                <button class="small-button"
                    onclick="selectItem('${d.id}')">
                    Select
                </button>
            </td>
        </tr>
    `).join("");

    $("inventoryEmpty").hidden = filtered.length > 0;
}

// Fill inventory dropdown
function renderInventoryOptions() {
    const select = $("inventorySelect");
    const previous = select.value;

    select.innerHTML = '<option value="">Select Item</option>';

    donations.filter(d => d.quantity > 0).forEach(d => {
        const option = document.createElement("option");
        option.value = d.id;
        option.textContent =
            `${d.name} (${d.category}) - ${d.quantity} available`;
        select.appendChild(option);
    });

    if ([...select.options].some(o => o.value === previous)) {
        select.value = previous;
    }
}

// Select an inventory item from the table
function selectItem(id) {
    $("inventorySelect").value = id;
    $("distribution").scrollIntoView({ behavior: "smooth" });
}

// Show recipient requests
function renderRequests() {
    $("requestTable").innerHTML = requests.map(r => `
        <tr>
            <td>${clean(r.recipient)}</td>
            <td>${clean(r.category)}</td>
            <td>${clean(r.item)}</td>
            <td>${r.quantity}</td>
            <td class="status">${clean(r.status)}</td>
        </tr>
    `).join("");

    $("requestEmpty").hidden = requests.length > 0;

    const select = $("requestSelect");
    const previous = select.value;

    select.innerHTML = '<option value="">Select Requirement</option>';

    requests.filter(r => r.status !== "Distributed").forEach(r => {
        const option = document.createElement("option");
        option.value = r.id;
        option.textContent =
            `${r.recipient} - ${r.item} (${r.quantity - r.allocated} needed)`;
        select.appendChild(option);
    });

    if ([...select.options].some(o => o.value === previous)) {
        select.value = previous;
    }
}

// Show distribution records
function renderDistributions() {
    $("distributionTable").innerHTML = distributions.map(d => `
        <tr>
            <td>${clean(d.recipient)}</td>
            <td>${clean(d.item)}</td>
            <td>${d.quantity}</td>
            <td class="status">${clean(d.status)}</td>
            <td>
                ${d.status === "Allocated"
                    ? `<button class="small-button"
                        onclick="markDistributed('${d.id}')">
                        Mark Distributed
                       </button>`
                    : "Completed"}
            </td>
        </tr>
    `).join("");

    $("distributionEmpty").hidden = distributions.length > 0;
}

// Update dashboard totals
function renderDashboard() {
    $("totalItems").textContent = donations.reduce(
        (sum, d) => sum + d.quantity, 0
    );

    $("totalDonations").textContent = donations.length;
    $("totalRequests").textContent = requests.length;
}

// Refresh all sections
function renderAll() {
    renderDashboard();
    renderInventory();
    renderInventoryOptions();
    renderRequests();
    renderDistributions();
}

$("search").addEventListener("input", renderInventory);

renderAll();