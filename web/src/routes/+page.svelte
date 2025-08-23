<script>
  import { onMount } from 'svelte';
  let data = null;
  let loading = true;
  let err = '';

  async function load() {
    try {
      const r = await fetch('/data/today.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('No data');
      data = await r.json();
    } catch (e) {
      err = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function fmt(n) { return new Intl.NumberFormat().format(n); }
</script>

<svelte:head>
  <title>renfe.fail — retrasos de hoy</title>
  <meta name="description" content="Estadísticas de retrasos de Renfe (Cercanías) hoy" />
</svelte:head>

<main class="min-h-screen bg-[#0b0c10] text-white font-sans">
  <section class="max-w-5xl mx-auto p-6">
    <h1 class="text-3xl md:text-5xl font-extrabold">renfe.fail</h1>
    <p class="opacity-70 mt-2">viendo datos de <strong>{new Date().toLocaleDateString()}</strong> Renfe (Cercanías)</p>

    {#if loading}
      <p class="mt-10">Cargando…</p>
    {:else if err}
      <p class="mt-10 text-red-400">{err}. Aún no hay datos generados.</p>
    {:else}
      <div class="grid md:grid-cols-3 gap-4 mt-6">
        <Card title="Trenes analizados" value={fmt(data.sampleSize)} />
        <Card title=">=15 min de retraso" value={fmt(data.metrics.totals.delayed15)} />
        <Card title=">=30 min de retraso" value={fmt(data.metrics.totals.delayed30)} />
        <Card title="Cancelados" value={fmt(data.metrics.totals.cancelled)} />
        <Card title="Retraso medio salida" value={`${fmt(data.metrics.avgDelayDepartureMin)} min`} />
        {#if data.metrics.worst}
          <Card title="Peor retraso" value={`${fmt(data.metrics.worst.delayMin)} min`} sub={`Viaje ${data.metrics.worst.trip_id} ${data.metrics.worst.origin ?? ''}→${data.metrics.worst.destination ?? ''}`} />
        {/if}
      </div>

      <h2 class="text-xl font-bold mt-10">Distribución de retrasos (salida)</h2>
      <div class="grid grid-cols-5 gap-2 mt-3">
        {#each Object.entries(data.metrics.buckets) as [k,v]}
          <div class="bg-[#1f2833] rounded-xl p-4">
            <div class="text-sm opacity-70">{k}</div>
            <div class="text-2xl font-bold">{fmt(v)}</div>
          </div>
        {/each}
      </div>

      <p class="opacity-60 text-sm mt-10">
        Fuente: Renfe Data (Cercanías). Cálculo propio. Esta web no está afiliada a Renfe ni a Adif.
      </p>
    {/if}
  </section>
</main>

<!-- Card Component -->
<script>
  export let title = '';
  export let value = '';
  export let sub = '';
</script>

<svelte:component this={undefined} />

<!-- Card inline -->
{#if false}{/if}
{#key Math.random()}
  <svelte:fragment slot="Card">
    <div class="bg-[#1f2833] rounded-2xl p-5 shadow">
      <div class="text-sm opacity-70">{title}</div>
      <div class="text-3xl font-extrabold mt-1">{value}</div>
      {#if sub}
      <div class="text-xs opacity-60 mt-1">{sub}</div>
      {/if}
    </div>
  </svelte:fragment>
{/key}
