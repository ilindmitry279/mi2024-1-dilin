// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('add-expense-form');
    const expensesTableBody = document.getElementById('expenses-table-body');
    const formErrorDiv = document.getElementById('form-error');
    const listErrorDiv = document.getElementById('list-error');
    const categoryFilterInput = document.getElementById('category-filter');
    const clearFilterBtn = document.getElementById('clear-filter-btn');
    const tableHead = document.querySelector('thead');

    // --- State Management ---
    let allExpenses = []; // Local cache for all expenses
    let currentSort = {
        column: 'category', // Default sort column
        order: 'asc'        // Default sort order
    };

    // --- Helper function to prevent XSS by escaping HTML ---
    function escapeHTML(str) {
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(str || ''));
        return p.innerHTML;
    }

    // --- Debounce function for performance optimization ---
    function debounce(func, delay = 250) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // --- UI Update Functions ---
    function updateSortIndicators() {
        document.querySelectorAll('th.sortable span').forEach(span => {
            span.textContent = '';
        });

        const activeHeader = document.querySelector(`th[data-sort="${currentSort.column}"]`);
        if (activeHeader) {
            const indicator = activeHeader.querySelector('span');
            indicator.textContent = currentSort.order === 'asc' ? ' ▲' : ' ▼';
        }
    }

    // --- Core Rendering Logic ---
    const renderExpenses = () => {
        let expensesToRender = [...allExpenses];

        // 1. Filter
        if (categoryFilterInput) {
            const filterValue = categoryFilterInput.value.toLowerCase().trim();
            if (filterValue) {
                expensesToRender = expensesToRender.filter(expense =>
                    expense.category.toLowerCase().includes(filterValue)
                );
            }
        }

        // 2. Sort
        expensesToRender.sort((a, b) => {
            const column = currentSort.column;
            const order = currentSort.order;
            const valA = a[column];
            const valB = b[column];

            let comparison = 0;
            if (typeof valA === 'number' || column === 'amount') {
                comparison = parseFloat(valA) - parseFloat(valB);
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
            
            return order === 'desc' ? comparison * -1 : comparison;
        });

        // 3. Render to DOM
        expensesTableBody.innerHTML = '';
        updateSortIndicators();

        if (expensesToRender.length === 0) {
            const message = categoryFilterInput && categoryFilterInput.value ? 'No expenses match your filter.' : 'No expenses found. Add one above!';
            expensesTableBody.innerHTML = `<tr><td colspan="3">${message}</td></tr>`;
            return;
        }

        expensesToRender.forEach(expense => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHTML(expense.category)}</td>
                <td>$${parseFloat(expense.amount).toFixed(2)}</td>
                <td>
                    <button class="delete-btn" data-id="${expense.expense_id}">Delete</button>
                </td>
            `;
            expensesTableBody.appendChild(row);
        });
    };

    // --- API Interaction ---
    const fetchExpenses = async () => {
        try {
            const response = await fetch('/api/expenses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allExpenses = await response.json();
            renderExpenses();
        } catch (error) {
            console.error('Error fetching expenses:', error);
            listErrorDiv.textContent = 'Failed to load expenses. Is the server running?';
        }
    };

    // --- Event Listeners ---
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const category = document.getElementById('category').value;
            const amount = document.getElementById('amount').value;

            if (!category.trim() || !amount) {
                formErrorDiv.textContent = 'Category and Amount are required.';
                return;
            }

            try {
                const response = await fetch('/api/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category: category.trim(), amount }),
                });
                if (!response.ok) throw new Error('Failed to add expense.');
                
                form.reset();
                formErrorDiv.textContent = '';
                await fetchExpenses();
            } catch (error) {
                console.error('Error adding expense:', error);
                formErrorDiv.textContent = error.message;
            }
        });
    }

    if (expensesTableBody) {
        expensesTableBody.addEventListener('click', async (event) => {
            if (event.target.classList.contains('delete-btn')) {
                const expenseId = event.target.dataset.id;
                if (!confirm('Are you sure you want to delete this expense?')) return;

                try {
                    const response = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('Failed to delete expense.');
                    await fetchExpenses();
                } catch (error) {
                    console.error('Error deleting expense:', error);
                    listErrorDiv.textContent = 'Could not delete the expense.';
                }
            }
        });
    }

    if (tableHead) {
        tableHead.addEventListener('click', (event) => {
            const header = event.target.closest('th.sortable');
            if (!header) return;

            const newSortColumn = header.dataset.sort;

            if (currentSort.column === newSortColumn) {
                currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = newSortColumn;
                currentSort.order = 'asc';
            }

            renderExpenses();
        });
    }

    // This is the key fix: check if the element exists before adding a listener.
    if (categoryFilterInput) {
        categoryFilterInput.addEventListener('input', debounce(renderExpenses));
    } else {
        console.warn('Warning: The category filter input element was not found.');
    }

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', () => {
            if (categoryFilterInput) {
                categoryFilterInput.value = ''; // Очищуємо поле вводу
            }
            renderExpenses(); // Перемальовуємо таблицю, щоб показати всі записи
        });
    }

    // Initial data load
    fetchExpenses();
});