// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('add-expense-form');
    const expensesTableBody = document.getElementById('expenses-table-body');
    const formErrorDiv = document.getElementById('form-error');
    const listErrorDiv = document.getElementById('list-error');

    // ПРИМІТКА: Додайте input з id="filter-category" у ваш HTML, щоб фільтр працював.
    // напр., <input type="text" id="filter-category" placeholder="Фільтрувати за категорією...">
    const filterInput = document.getElementById('filter-category');

    let allExpenses = []; // Для зберігання всіх витрат для фільтрації на клієнті

    // --- Helper function to prevent XSS by escaping HTML ---
    function escapeHTML(str) {
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(str));
        return p.innerHTML;
    }

    // --- Відображає список витрат у таблиці ---
    const renderExpenses = (expensesToRender) => {
        expensesTableBody.innerHTML = ''; // Очистити попередні записи

        if (expensesToRender.length === 0) {
            const filterValue = filterInput ? filterInput.value : '';
            if (filterValue) {
                expensesTableBody.innerHTML = '<tr><td colspan="3">Витрат за вашим фільтром не знайдено.</td></tr>';
            } else {
                expensesTableBody.innerHTML = '<tr><td colspan="3">Витрат не знайдено. Додайте першу!</td></tr>';
            }
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

    // --- Sorting state ---
    let sortState = {
        column: null, // 'category' or 'amount'
        direction: null // null | 'asc' | 'desc'
    };

    // --- Sorting function ---
    function sortExpenses(expenses) {
        if (!sortState.column || !sortState.direction) return expenses;
        const sorted = [...expenses];
        sorted.sort((a, b) => {
            let valA = a[sortState.column];
            let valB = b[sortState.column];
            if (sortState.column === 'amount') {
                valA = parseFloat(valA);
                valB = parseFloat(valB);
            } else {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }
            if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }

    // --- Modified filter and render ---
    const applyFilterAndRender = () => {
        const filterText = filterInput ? filterInput.value.toLowerCase().trim() : '';
        let filteredExpenses = allExpenses.filter(expense =>
            !filterText || expense.category.toLowerCase().startsWith(filterText)
        );
        filteredExpenses = sortExpenses(filteredExpenses);
        renderExpenses(filteredExpenses);
    };

    // --- (1) Отримує витрати з сервера ---
    const fetchAndRenderExpenses = async () => {
        try {
            const response = await fetch('/api/expenses');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            allExpenses = await response.json();
            listErrorDiv.textContent = '';
            applyFilterAndRender(); // Застосувати поточний фільтр до нових даних
        } catch (error) {
            console.error('Error fetching expenses:', error);
            listErrorDiv.textContent = 'Failed to load expenses. Please try again later.';
        }
    };

    // --- (2) Handle form submission to POST a new expense ---
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default page reload

        const category = document.getElementById('category').value;
        const amount = document.getElementById('amount').value;

        // Basic validation
        if (!category.trim() || !amount) {
            formErrorDiv.textContent = 'Category and Amount are required.';
            return;
        }

        const newExpense = {
            category: category.trim(),
            amount: amount,
        };

        try {
            const response = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newExpense),
            });

            const result = await response.json();

            if (!response.ok) {
                // (4) Show API error message from the server
                throw new Error(result.error || 'Failed to add expense.');
            }

            // Clear form and errors, then refresh the list
            form.reset();
            formErrorDiv.textContent = '';
            await fetchAndRenderExpenses();

        } catch (error) {
            console.error('Error adding expense:', error);
            formErrorDiv.textContent = error.message;
        }
    });

    // --- (3) Handle delete button clicks using event delegation ---
    expensesTableBody.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const expenseId = event.target.dataset.id;
            
            if (!confirm('Are you sure you want to delete this expense?')) {
                return;
            }

            try {
                const response = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.error || 'Failed to delete expense.');
                }
                // Refresh the list to show the item has been removed
                await fetchAndRenderExpenses();
            } catch (error) {
                console.error('Error deleting expense:', error);
                listErrorDiv.textContent = error.message;
            }
        }
    });

    // --- Обробка фільтрації під час введення тексту ---
    if (filterInput) {
        filterInput.addEventListener('input', applyFilterAndRender);
    }

    // --- Handle header clicks for sorting ---
    document.getElementById('th-category').addEventListener('click', () => {
        if (sortState.column !== 'category') {
            sortState.column = 'category';
            sortState.direction = 'asc';
        } else if (sortState.direction === 'asc') {
            sortState.direction = 'desc';
        } else if (sortState.direction === 'desc') {
            sortState.direction = null;
            sortState.column = null;
        } else {
            sortState.direction = 'asc';
        }
        applyFilterAndRender();
    });

    document.getElementById('th-amount').addEventListener('click', () => {
        if (sortState.column !== 'amount') {
            sortState.column = 'amount';
            sortState.direction = 'asc';
        } else if (sortState.direction === 'asc') {
            sortState.direction = 'desc';
        } else if (sortState.direction === 'desc') {
            sortState.direction = null;
            sortState.column = null;
        } else {
            sortState.direction = 'asc';
        }
        applyFilterAndRender();
    });

    // Initial load of expenses when the page is ready
    fetchAndRenderExpenses();
});