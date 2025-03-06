import { useState, useEffect, useMemo } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Pie } from 'react-chartjs-2'
import './App.css'

ChartJS.register(ArcElement, Tooltip, Legend)

interface Expense {
  id: string
  date: string
  description: string
  amount: number
  category: 'food' | 'transportation' | 'entertainment' | 'utilities' | 'housing' | 'healthcare' | 'shopping' | 'education' | 'insurance' | 'other'
  recurring?: boolean
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  nextDueDate?: string
}

interface BudgetGoal {
  category: string
  amount: number
  spent: number
}

function App() {
  const [budget, setBudget] = useState(() => {
    const saved = localStorage.getItem('budget')
    return saved || ''
  })
  
  const [isSetup, setIsSetup] = useState(() => {
    return localStorage.getItem('isSetup') === 'true'
  })
  
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem('expenses')
      const parsedExpenses = saved ? JSON.parse(saved) : []
      
      if (!Array.isArray(parsedExpenses)) {
        return []
      }
      
      const validExpenses = parsedExpenses.filter((expense: any) => {
        return (
          expense &&
          typeof expense.date === 'string' &&
          typeof expense.description === 'string' &&
          typeof expense.amount === 'number' &&
          ['food', 'transportation', 'entertainment', 'utilities', 'housing', 'healthcare', 'shopping', 'education', 'insurance', 'other'].includes(expense.category)
        )
      })

      return validExpenses
    } catch (error) {
      console.error('Error loading expenses:', error)
      return []
    }
  })

  const [budgetGoals, setBudgetGoals] = useState<BudgetGoal[]>(() => {
    try {
      const saved = localStorage.getItem('budgetGoals')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Error loading budget goals:', error)
      return []
    }
  })

  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'year'>('month')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const expensesPerPage = 10

  // Memoize expensive calculations
  const categoryTotals = useMemo(() => {
    return expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount
      return acc
    }, {} as Record<string, number>)
  }, [expenses])

  const spendingOverview = useMemo(() => {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0)
    return Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0
    }))
  }, [categoryTotals])

  const filteredExpenses = expenses.filter(expense => 
    expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Update pagination to use filtered expenses
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * expensesPerPage
    return filteredExpenses.slice(startIndex, startIndex + expensesPerPage)
  }, [filteredExpenses, currentPage])

  const totalPages = Math.ceil(filteredExpenses.length / expensesPerPage)

  useEffect(() => {
    try {
      localStorage.setItem('budget', budget)
      localStorage.setItem('isSetup', String(isSetup))
      localStorage.setItem('expenses', JSON.stringify(expenses))
      localStorage.setItem('budgetGoals', JSON.stringify(budgetGoals))
    } catch (error) {
      console.error('Error saving to localStorage:', error)
      alert('Failed to save data. Your browser might be in private mode or storage is full.')
    }
  }, [budget, isSetup, expenses, budgetGoals])

  const handleSetBudget = (e: React.FormEvent) => {
    e.preventDefault()
    const budgetNum = Number(budget)
    if (budget && !isNaN(budgetNum) && budgetNum > 0) {
      setIsSetup(true)
    } else {
      alert('Please enter a valid budget amount greater than 0')
    }
  }

  const updateBudgetGoals = (expense: Expense) => {
    setBudgetGoals(prev => prev.map(goal => {
      if (goal.category === expense.category) {
        return {
          ...goal,
          spent: goal.spent + expense.amount
        }
      }
      return goal
    }))
  }

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const form = e.target as HTMLFormElement
      const date = (form.elements.namedItem('date') as HTMLInputElement).value
      const description = (form.elements.namedItem('description') as HTMLInputElement).value
      const amount = Number((form.elements.namedItem('amount') as HTMLInputElement).value)
      const category = (form.elements.namedItem('category') as HTMLSelectElement).value as Expense['category']
      const recurring = (form.elements.namedItem('recurring') as HTMLInputElement).checked
      const recurringFrequency = (form.elements.namedItem('recurringFrequency') as HTMLSelectElement).value as Expense['recurringFrequency']

      // Validate date
      const selectedDate = new Date(date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (selectedDate > today) {
        throw new Error('Cannot add expenses for future dates')
      }

      if (!date || !description || amount <= 0 || !category) {
        throw new Error('Please fill in all fields with valid values')
      }

      const newExpense = {
        id: Date.now().toString(),
        date,
        description,
        amount,
        category,
        recurring,
        recurringFrequency: recurring ? recurringFrequency : undefined,
        nextDueDate: recurring ? calculateNextDueDate(date, recurringFrequency) : undefined
      }

      setExpenses(prev => [...prev, newExpense])
      updateBudgetGoals(newExpense)
      form.reset()
      setShowAddExpense(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred while adding the expense')
    } finally {
      setIsLoading(false)
    }
  }

  const calculateNextDueDate = (date: string, frequency: Expense['recurringFrequency']): string => {
    const currentDate = new Date(date)
    const nextDate = new Date(currentDate)
    
    switch (frequency) {
      case 'daily':
        nextDate.setDate(currentDate.getDate() + 1)
        break
      case 'weekly':
        nextDate.setDate(currentDate.getDate() + 7)
        break
      case 'monthly':
        nextDate.setMonth(currentDate.getMonth() + 1)
        break
      case 'yearly':
        nextDate.setFullYear(currentDate.getFullYear() + 1)
        break
    }
    
    return nextDate.toISOString().split('T')[0]
  }

  const addBudgetGoal = (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const category = (form.elements.namedItem('goalCategory') as HTMLSelectElement).value
    const amount = Number((form.elements.namedItem('goalAmount') as HTMLInputElement).value)

    if (category && amount > 0) {
      const newGoal = {
        category,
        amount,
        spent: 0
      }
      setBudgetGoals(prev => [...prev, newGoal])
      form.reset()
      setShowAddGoal(false)
    } else {
      alert('Please fill in all fields with valid values')
    }
  }

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(expense => expense.id !== id))
  }

  const balance = Number(budget) - expenses.reduce((total, exp) => total + exp.amount, 0)

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`
  }

  const getPieChartData = () => {
    const data = spendingOverview.map(({ category, amount }) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      amount
    }))

    return {
      labels: data.map(item => item.category),
      datasets: [
        {
          data: data.map(item => item.amount),
          backgroundColor: [
            'rgba(248, 113, 113, 0.8)', // food
            'rgba(96, 165, 250, 0.8)', // transportation
            'rgba(52, 211, 153, 0.8)', // entertainment
            'rgba(251, 191, 36, 0.8)', // utilities
            'rgba(244, 114, 182, 0.8)', // housing
            'rgba(167, 139, 250, 0.8)', // healthcare
            'rgba(45, 212, 191, 0.8)', // shopping
            'rgba(248, 113, 113, 0.8)', // education
            'rgba(96, 165, 250, 0.8)', // insurance
            'rgba(148, 163, 184, 0.8)', // other
          ],
          borderColor: [
            'rgba(248, 113, 113, 1)',
            'rgba(96, 165, 250, 1)',
            'rgba(52, 211, 153, 1)',
            'rgba(251, 191, 36, 1)',
            'rgba(244, 114, 182, 1)',
            'rgba(167, 139, 250, 1)',
            'rgba(45, 212, 191, 1)',
            'rgba(248, 113, 113, 1)',
            'rgba(96, 165, 250, 1)',
            'rgba(148, 163, 184, 1)',
          ],
          borderWidth: 1,
        },
      ],
    }
  }

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || ''
            const value = context.raw || 0
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
            const percentage = ((value / total) * 100).toFixed(1)
            return `${label}: ${formatCurrency(value)} (${percentage}%)`
          },
        },
      },
    },
  }

  const getBudgetGoalProgress = (category: string) => {
    const goal = budgetGoals.find(g => g.category === category)
    if (!goal) return null
    
    const spent = expenses
      .filter(e => e.category === category)
      .reduce((sum, e) => sum + e.amount, 0)
    
    return {
      goal,
      spent,
      percentage: (spent / goal.amount) * 100
    }
  }

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      deleteExpense(id);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

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

  return (
    <div className="app">
      <div className="container">
        <header className="app-header">
          <div className="header-left">
            <h1>Personal Finance Tracker</h1>
            <nav className="main-nav">
              <button className={`nav-button ${!showAddExpense && !showAddGoal ? 'active' : ''}`}>
                <span className="material-icons">dashboard</span>
                Dashboard
              </button>
              <button className="nav-button" onClick={() => setShowAddExpense(true)}>
                <span className="material-icons">add_circle</span>
                Add Expense
              </button>
              <button className="nav-button" onClick={() => setShowAddGoal(true)}>
                <span className="material-icons">flag</span>
                Set Goals
              </button>
            </nav>
          </div>
          <div className="header-right">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="material-icons">search</span>
            </div>
            <button 
              className="nav-button update-budget"
              onClick={() => {
                const newBudget = prompt('Enter new budget amount:', budget)
                if (newBudget !== null) {
                  const budgetNum = Number(newBudget)
                  if (!isNaN(budgetNum) && budgetNum > 0) {
                    setBudget(newBudget)
                  } else {
                    alert('Please enter a valid budget amount greater than 0')
                  }
                }
              }}
            >
              <span className="material-icons">edit</span>
              Update Budget
            </button>
          </div>
        </header>
        
        <div className="dashboard-grid">
          <div className="balance-card">
            <div className="budget-info">Current Balance</div>
            <div className={`balance ${balance >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(balance)}
            </div>
            <div className="budget-info">
              Budget: {formatCurrency(Number(budget))}
            </div>
          </div>

          <div className="timeframe-selector">
            <button 
              className={`timeframe-button ${selectedTimeframe === 'week' ? 'active' : ''}`}
              onClick={() => setSelectedTimeframe('week')}
            >
              Week
            </button>
            <button 
              className={`timeframe-button ${selectedTimeframe === 'month' ? 'active' : ''}`}
              onClick={() => setSelectedTimeframe('month')}
            >
              Month
            </button>
            <button 
              className={`timeframe-button ${selectedTimeframe === 'year' ? 'active' : ''}`}
              onClick={() => setSelectedTimeframe('year')}
            >
              Year
            </button>
          </div>

          {expenses.length === 0 && (
            <div className="welcome-message">
              <h2>Welcome to Your Personal Finance Tracker!</h2>
              <p>Get started by adding your first expense or setting up a budget goal.</p>
              <div className="quick-actions">
                <button onClick={() => setShowAddExpense(true)}>
                  <span className="material-icons">add_circle</span>
                  Add Your First Expense
                </button>
                <button onClick={() => setShowAddGoal(true)}>
                  <span className="material-icons">flag</span>
                  Set Up Budget Goals
                </button>
              </div>
            </div>
          )}

          {spendingOverview.length > 0 && (
            <>
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

              <div className="pie-chart-container">
                <h2>Spending Distribution</h2>
                <div className="pie-chart">
                  <Pie data={getPieChartData()} options={pieChartOptions} />
                </div>
              </div>
            </>
          )}

          {budgetGoals.length > 0 && (
            <div className="budget-goals">
              <h2>Budget Goals</h2>
              <div className="goals-grid">
                {budgetGoals.map(goal => {
                  const progress = getBudgetGoalProgress(goal.category)
                  if (!progress) return null
                  
                  return (
                    <div key={goal.category} className="goal-card">
                      <div className="goal-header">
                        <span className={`category-tag ${goal.category}`}>
                          {goal.category.charAt(0).toUpperCase() + goal.category.slice(1)}
                        </span>
                        <span className="goal-amount">
                          {formatCurrency(progress.spent)} / {formatCurrency(goal.amount)}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className={`progress-fill ${goal.category} ${progress.percentage > 100 ? 'over-budget' : ''}`}
                          style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                        />
                      </div>
                      <div className="goal-footer">
                        <span className="percentage">
                          {progress.percentage.toFixed(1)}%
                        </span>
                        {progress.percentage > 100 && (
                          <span className="over-budget-warning">
                            Over budget by {formatCurrency(progress.spent - goal.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="expenses-list">
            <h2>Recent Expenses</h2>
            {expenses.length === 0 ? (
              <p>No expenses yet. Add your first expense to get started!</p>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="desktop-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedExpenses.map((expense) => (
                        <tr key={expense.id}>
                          <td>{formatDate(expense.date)}</td>
                          <td>{expense.description}</td>
                          <td>
                            <span className={`category-tag ${expense.category.toLowerCase()}`}>
                              {expense.category}
                            </span>
                          </td>
                          <td>${expense.amount.toFixed(2)}</td>
                          <td>
                            <div className="header-actions">
                              <button
                                className="icon-button"
                                onClick={() => handleEditExpense(expense)}
                                title="Edit"
                              >
                                <span className="material-icons">edit</span>
                              </button>
                              <button
                                className="icon-button delete"
                                onClick={() => handleDeleteExpense(expense.id)}
                                title="Delete"
                              >
                                <span className="material-icons">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="mobile-cards">
                  {paginatedExpenses.map((expense) => (
                    <div key={expense.id} className="expense-card">
                      <div className="expense-card-header">
                        <span className="expense-date">{formatDate(expense.date)}</span>
                        <span className={`category-tag ${expense.category.toLowerCase()}`}>
                          {expense.category}
                        </span>
                      </div>
                      <div className="expense-card-body">
                        <p className="expense-description">{expense.description}</p>
                        <p className="expense-amount">${expense.amount.toFixed(2)}</p>
                      </div>
                      <div className="expense-card-footer">
                        <button
                          className="icon-button"
                          onClick={() => handleEditExpense(expense)}
                          title="Edit"
                        >
                          <span className="material-icons">edit</span>
                        </button>
                        <button
                          className="icon-button delete"
                          onClick={() => handleDeleteExpense(expense.id)}
                          title="Delete"
                        >
                          <span className="material-icons">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {showAddExpense && (
          <div className="modal">
            <div className="modal-content">
              <h2>Add New Expense</h2>
              <form onSubmit={addExpense}>
                <div className="form-group">
                  <label htmlFor="date">Date</label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    max={new Date().toISOString().split('T')[0]}
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
                    <option value="housing">Housing</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="shopping">Shopping</option>
                    <option value="education">Education</option>
                    <option value="insurance">Insurance</option>
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
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      name="recurring"
                      id="recurring"
                    />
                    Recurring Expense
                  </label>
                </div>
                <div className="form-group recurring-frequency" style={{ display: 'none' }}>
                  <label htmlFor="recurringFrequency">Frequency</label>
                  <select
                    id="recurringFrequency"
                    name="recurringFrequency"
                    className="category-select"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowAddExpense(false)}>Cancel</button>
                  <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Adding...' : 'Add Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAddGoal && (
          <div className="modal">
            <div className="modal-content">
              <h2>Add Budget Goal</h2>
              <form onSubmit={addBudgetGoal}>
                <div className="form-group">
                  <label htmlFor="goalCategory">Category</label>
                  <select
                    id="goalCategory"
                    name="goalCategory"
                    required
                    className="category-select"
                  >
                    <option value="">Select a category</option>
                    <option value="food">Food & Dining</option>
                    <option value="transportation">Transportation</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="utilities">Utilities</option>
                    <option value="housing">Housing</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="shopping">Shopping</option>
                    <option value="education">Education</option>
                    <option value="insurance">Insurance</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="goalAmount">Target Amount</label>
                  <input
                    type="number"
                    id="goalAmount"
                    name="goalAmount"
                    placeholder="Enter target amount"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowAddGoal(false)}>Cancel</button>
                  <button type="submit">Add Goal</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
