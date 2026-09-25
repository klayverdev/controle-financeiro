// Default seed data (usado apenas na primeira vez de cada usuário, para popular o banco vazio)
const defaultTransactions = [
    { description: 'Salário Mensal', category: 'Salário', type: 'income', amount: 5500.00, date: '2026-09-01' },
    { description: 'Projeto Freelance Web', category: 'Freelance', type: 'income', amount: 1800.00, date: '2026-09-05' },
    { description: 'Supermercado Mensal', category: 'Alimentação', type: 'expense', amount: 850.50, date: '2026-09-06' },
    { description: 'Aluguel do Apartamento', category: 'Moradia', type: 'expense', amount: 1600.00, date: '2026-09-10' },
    { description: 'Combustível e Uber', category: 'Transporte', type: 'expense', amount: 320.00, date: '2026-09-12' },
    { description: 'Restaurante Fim de Semana', category: 'Lazer', type: 'expense', amount: 240.00, date: '2026-09-14' },
    { description: 'Plano de Saúde', category: 'Saúde', type: 'expense', amount: 450.00, date: '2026-09-15' },
    { description: 'Dividendos Ações', category: 'Investimentos', type: 'income', amount: 320.40, date: '2026-09-20' }
];

let transactions = [];
let categoryChartInstance = null;
let monthlyChartInstance = null;
let transactionsRef = null;
let unsubscribeSnapshot = null;
let currentUser = null;
let authMode = 'login'; // 'login' ou 'signup'
let seededForUser = {};

// ---------------------------------------------------------
// INICIALIZAÇÃO
// ---------------------------------------------------------

window.onload = function() {
    const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
    document.getElementById('filterMonth').value = currentMonthStr;

    if (typeof auth === 'undefined' || typeof db === 'undefined') {
        showConnectionBanner('Firebase não configurado. Edite o arquivo firebase-config.js com suas chaves.');
        return;
    }

    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            showApp();
            connectToUserDatabase(user.uid);
        } else {
            currentUser = null;
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
            transactions = [];
            showAuthScreen();
        }
    });
};

function showAuthScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appMain').classList.add('hidden');
    document.getElementById('userEmailLabel').innerText = '';
}

function showApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appMain').classList.remove('hidden');
    document.getElementById('userEmailLabel').innerText = currentUser.email;
}

// ---------------------------------------------------------
// AUTENTICAÇÃO (LOGIN / CADASTRO / LOGOUT)
// ---------------------------------------------------------

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'signup' : 'login';
    const isLogin = authMode === 'login';
    document.getElementById('authTitle').innerText = isLogin ? 'Entrar na sua conta' : 'Criar sua conta';
    document.getElementById('authSubmitBtn').innerText = isLogin ? 'Entrar' : 'Criar conta';
    document.getElementById('authToggleText').innerText = isLogin ? 'Ainda não tem conta?' : 'Já tem uma conta?';
    document.getElementById('authToggleBtn').innerText = isLogin ? 'Criar conta' : 'Entrar';
    hideAuthError();
}

function showAuthError(message) {
    const el = document.getElementById('authError');
    el.innerText = message;
    el.classList.remove('hidden');
}

function hideAuthError() {
    document.getElementById('authError').classList.add('hidden');
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    hideAuthError();

    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const submitBtn = document.getElementById('authSubmitBtn');
    submitBtn.disabled = true;

    try {
        if (authMode === 'login') {
            await auth.signInWithEmailAndPassword(email, password);
        } else {
            await auth.createUserWithEmailAndPassword(email, password);
        }
        document.getElementById('authForm').reset();
    } catch (error) {
        showAuthError(traduzErroFirebase(error));
    } finally {
        submitBtn.disabled = false;
    }
}

function logout() {
    if (!confirm('Deseja sair da sua conta?')) return;
    auth.signOut();
}

function traduzErroFirebase(error) {
    const code = error.code || '';
    const map = {
        'auth/invalid-email': 'E-mail inválido.',
        'auth/user-disabled': 'Esta conta foi desativada.',
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
        'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.'
    };
    return map[code] || 'Ocorreu um erro. Tente novamente.';
}

// ---------------------------------------------------------
// BANCO DE DADOS (por usuário)
// ---------------------------------------------------------

function showConnectionBanner(text) {
    const banner = document.getElementById('connectionBanner');
    document.getElementById('connectionBannerText').innerText = text;
    banner.classList.remove('hidden');
}

function hideConnectionBanner() {
    document.getElementById('connectionBanner').classList.add('hidden');
}

function connectToUserDatabase(uid) {
    showConnectionBanner('Conectando ao banco de dados...');

    // Cada usuário tem sua própria subcoleção: users/{uid}/transactions
    transactionsRef = db.collection('users').doc(uid).collection('transactions');

    if (unsubscribeSnapshot) unsubscribeSnapshot();

    unsubscribeSnapshot = transactionsRef.onSnapshot(
        async (snapshot) => {
            hideConnectionBanner();
            transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (transactions.length === 0 && !seededForUser[uid]) {
                seededForUser[uid] = true;
                await seedDefaultData();
                return; // onSnapshot dispara de novo automaticamente
            }

            transactions.sort((a, b) => (a.date < b.date ? 1 : -1));
            renderApp();
        },
        (error) => {
            console.error('Erro ao conectar ao Firestore:', error);
            showConnectionBanner('Erro ao conectar ao banco de dados. Verifique as regras do Firestore.');
            renderApp();
        }
    );
}

async function seedDefaultData() {
    try {
        const batch = db.batch();
        defaultTransactions.forEach(tx => {
            const docRef = transactionsRef.doc();
            batch.set(docRef, tx);
        });
        await batch.commit();
    } catch (error) {
        console.error('Erro ao popular dados iniciais:', error);
    }
}

// ---------------------------------------------------------
// MODAIS DE MENSAGEM
// ---------------------------------------------------------

function showMessage(title, text, isError = false) {
    document.getElementById('messageModalTitle').innerText = title;
    document.getElementById('messageModalText').innerText = text;
    const iconDiv = document.getElementById('messageModalIcon');
    if (isError) {
        iconDiv.className = "w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl";
        iconDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    } else {
        iconDiv.className = "w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl";
        iconDiv.innerHTML = '<i class="fa-solid fa-check"></i>';
    }
    document.getElementById('messageModal').classList.remove('hidden');
}

function closeMessageModal() {
    document.getElementById('messageModal').classList.add('hidden');
}

// ---------------------------------------------------------
// MODAL DE LANÇAMENTO
// ---------------------------------------------------------

function openTransactionModal(id = null) {
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionId').value = '';

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transDate').value = today;
    setTransactionType('income');

    if (id) {
        document.getElementById('modalTitle').innerText = 'Editar Lançamento';
        const tx = transactions.find(t => t.id === id);
        if (tx) {
            document.getElementById('transactionId').value = tx.id;
            document.getElementById('transDescription').value = tx.description;
            document.getElementById('transAmount').value = tx.amount;
            document.getElementById('transDate').value = tx.date;
            document.getElementById('transCategory').value = tx.category;
            setTransactionType(tx.type);
        }
    } else {
        document.getElementById('modalTitle').innerText = 'Novo Lançamento';
    }

    document.getElementById('transactionModal').classList.remove('hidden');
}

function closeTransactionModal() {
    document.getElementById('transactionModal').classList.add('hidden');
}

function setTransactionType(type) {
    document.getElementById('transactionType').value = type;
    const incBtn = document.getElementById('typeIncomeBtn');
    const expBtn = document.getElementById('typeExpenseBtn');
    if (type === 'income') {
        incBtn.className = "py-2.5 px-4 rounded-xl text-sm font-semibold border border-slate-200 bg-emerald-50 text-emerald-700 transition flex items-center justify-center space-x-2";
        expBtn.className = "py-2.5 px-4 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-600 transition flex items-center justify-center space-x-2";
    } else {
        expBtn.className = "py-2.5 px-4 rounded-xl text-sm font-semibold border border-slate-200 bg-rose-50 text-rose-700 transition flex items-center justify-center space-x-2";
        incBtn.className = "py-2.5 px-4 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-600 transition flex items-center justify-center space-x-2";
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('transactionId').value;
    const description = document.getElementById('transDescription').value;
    const amount = parseFloat(document.getElementById('transAmount').value);
    const date = document.getElementById('transDate').value;
    const category = document.getElementById('transCategory').value;
    const type = document.getElementById('transactionType').value;

    if (!description || isNaN(amount) || !date) {
        showMessage('Atenção', 'Preencha todos os campos corretamente.', true);
        return;
    }

    if (!transactionsRef) {
        showMessage('Erro', 'Banco de dados não configurado.', true);
        return;
    }

    try {
        const data = { description, amount, date, category, type };
        if (id) {
            await transactionsRef.doc(id).update(data);
        } else {
            await transactionsRef.add(data);
        }
        closeTransactionModal();
        showMessage('Sucesso', 'Lançamento salvo com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar lançamento:', error);
        showMessage('Erro', 'Não foi possível salvar no banco de dados.', true);
    }
}

async function deleteTransaction(id) {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) return;
    try {
        await transactionsRef.doc(id).delete();
        showMessage('Sucesso', 'Lançamento excluído com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir lançamento:', error);
        showMessage('Erro', 'Não foi possível excluir do banco de dados.', true);
    }
}

async function resetData() {
    if (!confirm('Deseja apagar tudo e restaurar os dados de exemplo padrão?')) return;
    try {
        const snapshot = await transactionsRef.get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        if (currentUser) seededForUser[currentUser.uid] = false;
        await seedDefaultData();
        showMessage('Sucesso', 'Dados restaurados com sucesso!');
    } catch (error) {
        console.error('Erro ao restaurar dados:', error);
        showMessage('Erro', 'Não foi possível restaurar os dados.', true);
    }
}

// ---------------------------------------------------------
// FILTROS E FORMATAÇÃO
// ---------------------------------------------------------

function getFilteredTransactions() {
    const filterMonth = document.getElementById('filterMonth').value;
    const filterCategory = document.getElementById('filterCategory').value;

    return transactions.filter(tx => {
        const txMonth = tx.date.split('-')[1];
        const matchMonth = (filterMonth === 'all' || txMonth === filterMonth);
        const matchCategory = (filterCategory === 'all' || tx.category === filterCategory);
        return matchMonth && matchCategory;
    });
}

function formatCurrency(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// ---------------------------------------------------------
// RENDERIZAÇÃO
// ---------------------------------------------------------

function renderApp() {
    const filtered = getFilteredTransactions();

    let totalIncome = 0;
    let totalExpense = 0;

    filtered.forEach(tx => {
        if (tx.type === 'income') {
            totalIncome += tx.amount;
        } else {
            totalExpense += tx.amount;
        }
    });

    const netBalance = totalIncome - totalExpense;

    document.getElementById('kpiReceitas').innerText = formatCurrency(totalIncome);
    document.getElementById('kpiDespesas').innerText = formatCurrency(totalExpense);
    const kpiSaldoEl = document.getElementById('kpiSaldo');
    kpiSaldoEl.innerText = formatCurrency(netBalance);

    const kpiSaldoIconBg = document.getElementById('kpiSaldoIconBg');
    if (netBalance >= 0) {
        kpiSaldoEl.className = "text-3xl font-bold text-slate-900 mt-1";
        kpiSaldoIconBg.className = "p-4 rounded-2xl bg-emerald-50 text-emerald-600";
    } else {
        kpiSaldoEl.className = "text-3xl font-bold text-rose-600 mt-1";
        kpiSaldoIconBg.className = "p-4 rounded-2xl bg-rose-50 text-rose-600";
    }

    const tbody = document.getElementById('transactionTableBody');
    tbody.innerHTML = '';
    document.getElementById('transactionCount').innerText = `${filtered.length} registro${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">Nenhum lançamento encontrado para os filtros selecionados.</td></tr>`;
    } else {
        filtered.forEach(tx => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50/80 transition";
            tr.innerHTML = `
                <td class="py-3.5 px-6 font-medium text-slate-600">${formatDate(tx.date)}</td>
                <td class="py-3.5 px-6 font-semibold text-slate-800">${tx.description}</td>
                <td class="py-3.5 px-6"><span class="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-medium">${tx.category}</span></td>
                <td class="py-3.5 px-6">
                    <span class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
                        <i class="fa-solid ${tx.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'} text-[10px]"></i>
                        <span>${tx.type === 'income' ? 'Receita' : 'Despesa'}</span>
                    </span>
                </td>
                <td class="py-3.5 px-6 text-right font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}">${tx.type === 'income' ? '+' : '-'} ${formatCurrency(tx.amount)}</td>
                <td class="py-3.5 px-6 text-center space-x-2">
                    <button onclick="openTransactionModal('${tx.id}')" class="text-slate-400 hover:text-emerald-600 transition p-1" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteTransaction('${tx.id}')" class="text-slate-400 hover:text-rose-600 transition p-1" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderCharts(filtered);
}

function renderCharts(filteredTransactions) {
    const expenseCategories = {};
    filteredTransactions.forEach(tx => {
        if (tx.type === 'expense') {
            expenseCategories[tx.category] = (expenseCategories[tx.category] || 0) + tx.amount;
        }
    });

    const catLabels = Object.keys(expenseCategories);
    const catData = Object.values(expenseCategories);

    const ctxCategory = document.getElementById('categoryChart').getContext('2d');
    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    categoryChartInstance = new Chart(ctxCategory, {
        type: 'doughnut',
        data: {
            labels: catLabels.length ? catLabels : ['Sem despesas'],
            datasets: [{
                data: catData.length ? catData : [1],
                backgroundColor: [
                    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } }
                }
            }
        }
    });

    const monthsMap = {
        '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
        '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
    };

    const monthlyIncome = Array(12).fill(0);
    const monthlyExpense = Array(12).fill(0);

    transactions.forEach(tx => {
        const parts = tx.date.split('-');
        if (parts.length === 3) {
            const mIndex = parseInt(parts[1], 10) - 1;
            if (mIndex >= 0 && mIndex < 12) {
                if (tx.type === 'income') monthlyIncome[mIndex] += tx.amount;
                else monthlyExpense[mIndex] += tx.amount;
            }
        }
    });

    const ctxMonthly = document.getElementById('monthlyChart').getContext('2d');
    if (monthlyChartInstance) {
        monthlyChartInstance.destroy();
    }

    monthlyChartInstance = new Chart(ctxMonthly, {
        type: 'bar',
        data: {
            labels: Object.values(monthsMap),
            datasets: [
                {
                    label: 'Receitas',
                    data: monthlyIncome,
                    backgroundColor: '#10b981',
                    borderRadius: 6
                },
                {
                    label: 'Despesas',
                    data: monthlyExpense,
                    backgroundColor: '#ef4444',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: { grid: { color: '#f1f5f9' }, beginAtZero: true }
            }
        }
    });
}

function exportCSV() {
    const filtered = getFilteredTransactions();
    if (filtered.length === 0) {
        showMessage('Atenção', 'Não há dados para exportar com os filtros atuais.', true);
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,ID,Data,Descricao,Categoria,Tipo,Valor\r\n";
    filtered.forEach(tx => {
        const row = [tx.id, tx.date, `"${tx.description}"`, `"${tx.category}"`, tx.type, tx.amount];
        csvContent += row.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "financeiro_pro_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessage('Sucesso', 'Planilha exportada com sucesso em formato CSV!');
}
