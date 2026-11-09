import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../../providers/auth_provider.dart';
import '../../../services/api_service.dart';
import '../../theme.dart';
import '../../widgets/premium_card.dart';
import '../../widgets/page_header.dart';

class ParentFees extends StatefulWidget {
  const ParentFees({super.key});

  @override
  State<ParentFees> createState() => _ParentFeesState();
}

class _ParentFeesState extends State<ParentFees> {
  bool _isLoading = true;
  List<dynamic> _feesList = [];
  String _selectedMonth = '';
  final List<Map<String, String>> _monthsList = [];

  @override
  void initState() {
    super.initState();
    _generateMonths();
    _fetchData();
  }

  void _generateMonths() {
    final now = DateTime.now();
    for (int i = 0; i < 12; i++) {
      final d = DateTime(now.year, now.month - i, 1);
      final monthStr = '${d.year}-${d.month.toString().padLeft(2, '0')}';
      final monthLabel = DateFormat('MMMM yyyy').format(d);
      _monthsList.add({'value': monthStr, 'label': monthLabel});
    }
    _selectedMonth = _monthsList.first['value']!;
  }

  String? _lastLoadedChildId;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final childId = Provider.of<AuthProvider>(context).activeChildId;
    if (childId != _lastLoadedChildId) {
      _lastLoadedChildId = childId;
      _fetchData();
    }
  }

  Future<void> _fetchData() async {
    try {
      final childId = Provider.of<AuthProvider>(context, listen: false).activeChildId;
      if (childId != null) {
        _feesList = await ApiService().getStudentFeeHistory(childId);
      }
    } catch (e) {
      debugPrint(e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  DateTime? _calculateNextPaymentDate(String lastPaidMonth, String duration) {
    if (lastPaidMonth.isEmpty) return null;
    final parts = lastPaidMonth.split('-');
    if (parts.length != 2) return null;
    final year = int.parse(parts[0]);
    final month = int.parse(parts[1]);
    
    DateTime nextDate = DateTime(year, month - 1, 1);
    int monthsToAdd = 1;
    if (duration == '3 months') monthsToAdd = 3;
    else if (duration == '6 months') monthsToAdd = 6;
    else if (duration == 'Annual') monthsToAdd = 12;
    
    return DateTime(nextDate.year, nextDate.month + monthsToAdd, 1);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppTheme.primaryColor),
      );
    }

    final paidFeesList = _feesList.where((f) => f['status'] == 'Paid').toList();
    final totalPaidAmount = paidFeesList.fold<double>(0.0, (sum, f) => sum + (double.tryParse(f['amount']?.toString() ?? '0') ?? 0.0));
    final unpaidFeesCount = _feesList.length - paidFeesList.length;
    final paidFeesCount = paidFeesList.length;

    paidFeesList.sort((a, b) {
      final monthCompare = (b['month'] ?? '').compareTo(a['month'] ?? '');
      if (monthCompare != 0) return monthCompare;
      final dateA = a['paidDate'] != null ? DateTime.tryParse(a['paidDate']) ?? DateTime(0) : DateTime(0);
      final dateB = b['paidDate'] != null ? DateTime.tryParse(b['paidDate']) ?? DateTime(0) : DateTime(0);
      return dateB.compareTo(dateA);
    });

    final mostRecentPaidFee = paidFeesList.isNotEmpty ? paidFeesList.first : null;
    final nextPaymentDate = mostRecentPaidFee != null 
        ? _calculateNextPaymentDate(mostRecentPaidFee['month'], mostRecentPaidFee['duration'] ?? 'Monthly')
        : null;

    final filteredFees = _feesList.where((f) => f['month'] == _selectedMonth).toList();
    final currentMonthFee = filteredFees.isNotEmpty ? filteredFees.first : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PageHeader(
            title: 'Fee Status',
            subtitle: 'Review monthly tuition payments, receipts, and dues.',
          ),

          // Month selector
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: AppTheme.surfaceColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.borderColor),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                value: _selectedMonth,
                items: _monthsList.map((m) => DropdownMenuItem(value: m['value'], child: Text(m['label']!))).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedMonth = val);
                },
              ),
            ),
          ),
          const SizedBox(height: 20),

          // KPIs Row
          Row(
            children: [
              Expanded(
                child: PremiumCard(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Total Paid', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      Text(
                        '₹${totalPaidAmount.toStringAsFixed(0)}',
                        style: const TextStyle(fontSize: 24, color: Color(0xFF10B981), fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: PremiumCard(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Records Status', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          _buildMiniBadge('Paid: $paidFeesCount', const Color(0xFF10B981), const Color(0xFFD1FAE5)),
                          _buildMiniBadge('Unpaid: $unpaidFeesCount', const Color(0xFFEF4444), const Color(0xFFFEE2E2)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          if (nextPaymentDate != null)
            PremiumCard(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Next Scheduled Payment', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      Text(
                        DateFormat('MMM dd, yyyy').format(nextPaymentDate),
                        style: TextStyle(
                          fontSize: 18,
                          color: nextPaymentDate.isBefore(DateTime.now()) ? const Color(0xFFEF4444) : AppTheme.primaryColor,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  if (nextPaymentDate.isBefore(DateTime.now()))
                    _buildMiniBadge('OVERDUE', const Color(0xFFEF4444), const Color(0xFFFEE2E2)),
                ],
              ),
            ),

          const SizedBox(height: 24),

          // Selected Month Status Card
          PremiumCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_monthsList.firstWhere((m) => m['value'] == _selectedMonth)['label']} Status',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                if (currentMonthFee != null) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildMiniBadge(
                        currentMonthFee['status'] ?? 'Unknown',
                        currentMonthFee['status'] == 'Paid' ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                        currentMonthFee['status'] == 'Paid' ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                      ),
                      Text(
                        '₹${currentMonthFee['amount'] ?? 0}',
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                  if (currentMonthFee['paidDate'] != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Paid on: ${DateFormat('MMM dd, yyyy').format(DateTime.parse(currentMonthFee['paidDate']))}',
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                    ),
                  ],
                ] else ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildMiniBadge('UNPAID', const Color(0xFFEF4444), const Color(0xFFFEE2E2)),
                      const Text('No ledger record found for month', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                    ],
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 24),
          Text(
            'Payment Ledger',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18),
          ),
          const SizedBox(height: 12),

          if (_feesList.isEmpty)
            const PremiumCard(
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(24.0),
                  child: Text('No fee records found in history.', style: TextStyle(color: AppTheme.textSecondary)),
                ),
              ),
            )
          else
            ...(_feesList.toList()..sort((a, b) => (b['month'] ?? '').compareTo(a['month'] ?? ''))).map((fee) {
              final mLabel = _monthsList.firstWhere((m) => m['value'] == fee['month'], orElse: () => {'label': fee['month'] ?? ''})['label'];
              final isPaid = fee['status'] == 'Paid';
              return Padding(
                padding: const EdgeInsets.only(bottom: 8.0),
                child: PremiumCard(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(mLabel ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                          const SizedBox(height: 4),
                          Text(
                            fee['paidDate'] != null ? DateFormat('MMM dd, yyyy').format(DateTime.parse(fee['paidDate'])) : 'Unpaid',
                            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          Text('₹${fee['amount'] ?? 0}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                          const SizedBox(width: 12),
                          _buildMiniBadge(
                            fee['status'] ?? 'Unknown',
                            isPaid ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                            isPaid ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
        ],
      ),
    );
  }

  Widget _buildMiniBadge(String value, Color color, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        value,
        style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 11),
      ),
    );
  }
}
