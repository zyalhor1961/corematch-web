'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    User,
    Building2,
    Mail,
    Phone,
    MapPin,
    FileText,
    Clock,
    TrendingUp,
    MoreHorizontal,
    ArrowLeft,
    Plus,
    MessageSquare,
    Calendar,
    CheckCircle,
    AlertCircle
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatCurrency } from '@/components/ui/SummaryCards';
import { formatDate } from '@/lib/erp/formatters';
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import Link from 'next/link';

// Mock timeline data
const timelineEvents = [
    { id: 1, type: 'email', title: 'Email envoyé', description: 'Relance facture #F2024-089', date: '2024-10-24T10:00:00', user: 'Système' },
    { id: 2, type: 'invoice', title: 'Facture créée', description: 'Facture #F2024-089 (4,500.00 €)', date: '2024-10-23T14:30:00', user: 'Jean Dupont' },
    { id: 3, type: 'call', title: 'Appel téléphonique', description: 'Discussion sur le nouveau projet', date: '2024-10-20T09:15:00', user: 'Marie Martin' },
    { id: 4, type: 'note', title: 'Note ajoutée', description: 'Client intéressé par le module RH', date: '2024-10-15T16:45:00', user: 'Jean Dupont' },
];

// Mock chart data
const revenueData = [
    { month: 'Jan', value: 4000 },
    { month: 'Fév', value: 3000 },
    { month: 'Mar', value: 5000 },
    { month: 'Avr', value: 2780 },
    { month: 'Mai', value: 1890 },
    { month: 'Juin', value: 2390 },
    { month: 'Juil', value: 3490 },
];

export default function Client360Page() {
    const params = useParams();
    const router = useRouter();
    const orgId = params.orgId as string;
    const clientId = params.clientId as string;

    const [loading, setLoading] = useState(true);
    const [client, setClient] = useState<any>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [stats, setStats] = useState({
        total_billed: 0,
        outstanding: 0,
        paid: 0
    });

    useEffect(() => {
        async function fetchClientData() {
            setLoading(true);
            try {
                // Fetch client details
                const { data: clientData, error: clientError } = await supabase
                    .from('clients')
                    .select('*')
                    .eq('id', clientId)
                    .single();

                if (clientError) throw clientError;
                setClient(clientData);

                // Fetch client invoices
                const { data: invoicesData, error: invoicesError } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('client_id', clientId)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (invoicesError) throw invoicesError;
                setInvoices(invoicesData || []);

                // Calculate stats (mocked calculation for demo if no data)
                const total = (invoicesData || []).reduce((acc, inv) => acc + (inv.total_ttc || 0), 0);
                const paid = (invoicesData || []).reduce((acc, inv) => acc + (inv.paid_amount || 0), 0);

                setStats({
                    total_billed: total,
                    outstanding: total - paid,
                    paid: paid
                });

            } catch (error) {
                console.error('Error fetching client data:', error);
            } finally {
                setLoading(false);
            }
        }

        if (clientId) {
            fetchClientData();
        }
    }, [clientId]);

    if (loading) {
        return <div className="p-8 space-y-4">
            <Skeleton className="h-12 w-1/3" />
            <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>;
    }

    if (!client) {
        return <div className="p-8 text-center">Client introuvable</div>;
    }

    return (
        <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                            {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                {client.name}
                                <Badge variant="outline" className="ml-2 text-xs font-normal bg-green-50 text-green-700 border-green-200">Actif</Badge>
                            </h1>
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                                <Building2 className="h-3 w-3" /> {client.company_name || 'Société'}
                                <span className="text-gray-300">•</span>
                                <MapPin className="h-3 w-3" /> {client.city || 'Paris'}, {client.country || 'France'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="h-4 w-4 mr-2" />
                        Nouvelle Facture
                    </Button>
                </div>
            </div>

            {/* 360 Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Info & Contacts */}
                <div className="space-y-6">
                    {/* Info Pod */}
                    <Card className="border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                        <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 py-3">
                            <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">Informations</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <div className="flex items-start gap-3">
                                <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Email</p>
                                    <a href={`mailto:${client.email}`} className="text-sm text-blue-600 hover:underline">{client.email || '-'}</a>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Téléphone</p>
                                    <a href={`tel:${client.phone}`} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900">{client.phone || '-'}</a>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Adresse</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {client.address}<br />
                                        {client.zip_code} {client.city}<br />
                                        {client.country}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">TVA / SIRET</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{client.vat_number || '-'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Pod */}
                    <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Performance</h3>
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-gray-500">Total Facturé</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.total_billed)}</p>
                                </div>
                                <div className="h-24 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={revenueData}>
                                            <defs>
                                                <linearGradient id="colorRevenueClient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRevenueClient)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Middle Column: Timeline & Activity */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Timeline Pod */}
                    <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between py-4">
                            <CardTitle className="text-lg font-semibold">Timeline 360°</CardTitle>
                            <Button variant="ghost" size="sm">Voir tout</Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="relative pl-8 pr-4 py-4 space-y-8 before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
                                {timelineEvents.map((event) => (
                                    <div key={event.id} className="relative">
                                        <div className={`absolute -left-[25px] mt-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${event.type === 'invoice' ? 'bg-green-500' :
                                                event.type === 'email' ? 'bg-blue-500' :
                                                    event.type === 'call' ? 'bg-purple-500' : 'bg-gray-400'
                                            }`}></div>
                                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{event.title}</h4>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{event.description}</p>
                                                </div>
                                                <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(event.date).toLocaleDateString()}</span>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                                                <User className="h-3 w-3" /> {event.user}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Invoices Pod */}
                    <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between py-4">
                            <CardTitle className="text-lg font-semibold">Dernières Factures</CardTitle>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={`/org/${orgId}/erp/invoices?client_id=${clientId}`}>Voir tout</Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {invoices.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">Aucune facture récente</div>
                                ) : (
                                    invoices.map((inv) => (
                                        <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-full ${inv.status === 'paid' ? 'bg-green-100 text-green-600' :
                                                        inv.status === 'overdue' ? 'bg-red-100 text-red-600' :
                                                            'bg-blue-100 text-blue-600'
                                                    }`}>
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{inv.invoice_number}</p>
                                                    <p className="text-xs text-gray-500">{formatDate(inv.invoice_date)}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(inv.total_ttc)}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                                                        inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                                            'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {inv.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
