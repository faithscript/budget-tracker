import { useState, useEffect } from 'react'
import './App.css'

interface Expense {
  date: string
  description: string
  amount: number
  category: 'food' | 'transportation' | 'entertainment' | 'utilities' | 'other'
}

function App() {
  // Initialize state with proper type checking and logging
  const [budget, setBudget] = useState(() => {
    const saved = localStorage.getItem('budget')
    console.log('Loading budget:', saved)
    return saved || ''
  })
  
  const [isSetup, setIsSetup] = useState(() => {
    const setupState = localStorage.getItem('isSetup') === 'true'
    console.log('Loading isSetup:', setupState)
    return setupState
  })
  
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem('expenses')
      console.log('Loading expenses:', saved)
      const parsedExpenses = saved ? JSON.parse(saved) : []
      
      // Validate the structure of loaded expenses
      if (!Array.isArray(parsedExpenses)) {
        console.warn('Loaded expenses is not an array, resetting to empty array')
        return []
      }
      
      // Ensure each expense has the correct structure
      const validExpenses = parsedExpenses.filter((expense: any) => {
        return (
          expense &&
          typeof expense.date === 'string' &&
          typeof expense.description === 'string' &&
          typeof expense.amount === 'number' &&
          ['food', 'transportation', 'entertainment', 'utilities', 'other'].includes(expense.category)
        )
      })

      if (validExpenses.length !== parsedExpenses.length) {
        console.warn('Some expenses were invalid and were filtered out')
      }

      return validExpenses
    } catch (error) {
      console.error('Error loading expenses:', error)
      return []
    }
  })

  // Persist state changes to localStorage with error handling
  useEffect(() => {
    try {
      localStorage.setItem('budget', budget)
      localStorage.setItem('isSetup', String(isSetup))
      localStorage.setItem('expenses', JSON.stringify(expenses))
      console.log('Saved to localStorage:', { budget, isSetup, expensesCount: expenses.length })
    } catch (error) {
      console.error('Error saving to localStorage:', error)
    }
  }, [budget, isSetup, expenses])

  // Calculate totals by category with error handling
  const categoryTotals = expenses.reduce((acc, expense) => {
    try {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount
    } catch (error) {
      console.error('Error calculating category total for expense:', expense, error)
    }
    return acc
  }, {} as Record<string, number>)

  const handleSetBudget = (e: React.FormEvent) => {
    e.preventDefault()
    const budgetNum = Number(budget)
    if (budget && !isNaN(budgetNum) && budgetNum > 0) {
      setIsSetup(true)
      console.log('Budget set:', budgetNum)
    } else {
      alert('Please enter a valid budget amount greater than 0')
    }
  }

  const addExpense = (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const date = (form.elements.namedItem('date') as HTMLInputElement).value
    const description = (form.elements.namedItem('description') as HTMLInputElement).value
    const amount = Number((form.elements.namedItem('amount') as HTMLInputElement).value)
    const category = (form.elements.namedItem('category') as HTMLSelectElement).value as Expense['category']

    if (date && description && amount > 0 && category) {
      const newExpense = { date, description, amount, category }
      console.log('Adding expense:', newExpense)
      setExpenses(prev => [...prev, newExpense])
      form.reset()
    } else {
      alert('Please fill in all fields with valid values')
    }
  }

  const balance = Number(budget) - expenses.reduce((total, exp) => total + exp.amount, 0)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getSpendingOverview = () => {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0)
    const overview = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0
    }))
    console.log('Spending overview:', overview)
    return overview
  }

  // Clear all data function (for debugging)
  const clearAllData = () => {
    if (window.confirm('Are you sure you want to reset all data?')) {
      localStorage.clear()
      setBudget('')
      setIsSetup(false)
      setExpenses([])
      console.log('All data cleared')
    }
  }

  if (!isSetup) {
    return (
      <div className="app">
        <div className="container">
          <div className="form-container initial-budget">
            <h1>Personal Finance Tracker</h1>
            <h2>Let's start by setting your budget</h2>
            <form onSubmit={handleSetBudget}>
              <div className="form-group">
                <label htmlFor="budget">Monthly Budget</label>
                <input
                  type="number"
                  id="budget"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Enter your monthly budget"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <button type="submit">Set Budget</button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const spendingOverview = getSpendingOverview()

  return (
    <div className="app">
      <div className="container">
        <h1>Personal Finance Tracker</h1>
        
        <div className="balance-card">
          <div className="budget-info">Current Balance</div>
          <div className={`balance ${balance >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(balance)}
          </div>
          <div className="budget-info">
            Budget: {formatCurrency(Number(budget))}
          </div>
        </div>

        {spendingOverview.length > 0 ? (
          <div className="spending-overview">
            <h2>Spending by Category</h2>
            <div className="category-bars">
              {spendingOverview.map(({ category, amount, percentage }) => (
                <div key={category} className="category-bar-container">
                  <div className="category-label">
                    <span>{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                    <span>{formatCurrency(amount)}</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className={`progress-fill ${category}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="percentage">{percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="form-container">
          <h2>Add New Expense</h2>
          <form onSubmit={addExpense}>
            <div className="form-group">
              <label htmlFor="date">Date</label>
              <input
                type="date"
                id="date"
                name="date"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <input
                type="text"
                id="description"
                name="description"
                placeholder="Enter expense description"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                required
                className="category-select"
              >
                <option value="">Select a category</option>
                <option value="food">Food & Dining</option>
                <option value="transportation">Transportation</option>
                <option value="entertainment">Entertainment</option>
                <option value="utilities">Utilities</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="amount">Amount</label>
              <input
                type="number"
                id="amount"
                name="amount"
                placeholder="Enter amount"
                step="0.01"
                min="0"
                required
              />
            </div>
            <button type="submit">Add Expense</button>
          </form>
        </div>

        <div className="expenses-list">
          <h2>Recent Expenses</h2>
          {expenses.length === 0 ? (
            <p>No expenses yet. Add your first expense above!</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense, index) => (
                    <tr key={index}>
                      <td>{new Date(expense.date).toLocaleDateString()}</td>
                      <td>{expense.description}</td>
                      <td>
                        <span className={`category-tag ${expense.category}`}>
                          {expense.category.charAt(0).toUpperCase() + expense.category.slice(1)}
                        </span>
                      </td>
                      <td>{formatCurrency(expense.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button 
                className="export-button" 
                onClick={clearAllData}
                style={{ marginTop: '1rem' }}
              >
                Reset All Data
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
