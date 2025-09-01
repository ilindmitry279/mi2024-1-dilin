// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('add-expense-form');
    const expensesTableBody = document.getElementById('expenses-table-body');
    const formErrorDiv = document.getElementById('form-error');
    const listErrorDiv = document.getElementById('list-error');

    // --- Helper function to prevent XSS by escaping HTML ---
    function escapeHTML(str) {
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(str));
        return p.innerHTML;
    }

    // --- (1) Fetch and render expenses on page load ---
    const fetchAndRenderExpenses = async () => {
        try {
            const response = await fetch('/api/expenses');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const expenses = await response.json();

            // Clear previous entries and errors
            expensesTableBody.innerHTML = '';
            listErrorDiv.textContent = '';

            if (expenses.length === 0) {
                expensesTableBody.innerHTML = '<tr><td colspan="3">No expenses found. Add one above!</td></tr>';
                return;
            }

            expenses.forEach(expense => {
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

    // Initial load of expenses when the page is ready
    fetchAndRenderExpenses();
});