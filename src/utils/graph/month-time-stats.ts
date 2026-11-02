// Month summary numbers for the Work Graph bar (people who logged time, hours).

export interface GraphMonthTimeStats {
  peopleWithHours: number;
  hoursSubmitted: number;
  hoursApproved: number;
  pendingWeeks: number;
}

/**
 * Real hours for the selected month from the project timesheet store, limited
 * to the people visible in this (scoped) graph. Only days inside the month are
 * counted. The bar used to show static demo snapshot numbers (always 0h and
 * "0 NDAs") even when hours were submitted and approved.
 */
export function computeGraphMonthTimeStats(
  weeks: Array<{ personId: string; graphNodeId?: string; weekStart: string; status: string; days: Array<{ hours?: number; totalHours?: number }> }>,
  monthKey: string,
  visiblePersonIds: Set<string>,
  /**
   * Every person node in the loaded graph. A week whose worker is not in the
   * graph at all was still returned by the server (wg_timesheet_weeks_visible),
   * e.g. the end client approving the agency's and sub's workers that graph
   * privity hides from it, so it counts. Weeks of people who ARE in the graph
   * but filtered out of the current view (an admin "viewing as" a party) do not.
   */
  graphPersonIds?: Set<string>,
): GraphMonthTimeStats {
  const people = new Set<string>();
  let submitted = 0;
  let approved = 0;
  let pending = 0;
  for (const week of weeks) {
    const notInGraph = !!graphPersonIds
      && !graphPersonIds.has(week.personId)
      && !(week.graphNodeId && graphPersonIds.has(week.graphNodeId));
    const id = visiblePersonIds.has(week.personId) ? week.personId
      : (week.graphNodeId && visiblePersonIds.has(week.graphNodeId) ? week.graphNodeId
        : (notInGraph ? week.personId : null));
    if (!id) continue;
    let hoursInMonth = 0;
    week.days.forEach((day, index) => {
      const date = new Date(`${week.weekStart}T00:00:00`);
      date.setDate(date.getDate() + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (key === monthKey) hoursInMonth += Number(day.totalHours ?? day.hours ?? 0) || 0;
    });
    if (hoursInMonth > 0) people.add(id);
    if (week.status === 'submitted' || week.status === 'approved') submitted += hoursInMonth;
    if (week.status === 'approved') approved += hoursInMonth;
    if (week.status === 'submitted') pending += 1;
  }
  return { peopleWithHours: people.size, hoursSubmitted: submitted, hoursApproved: approved, pendingWeeks: pending };
}
