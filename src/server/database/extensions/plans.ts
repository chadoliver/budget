import {DbClient} from '../DbClient';

export interface IPlanId {
	planId: string;
}

export interface IPlanEntity extends IPlanId {
	name: string;
	cost: number;
}

export async function createPlan(
	this: DbClient,
	{planId, name, cost}: IPlanEntity
): Promise<void> {
	await this.parameterisedQuery`
		INSERT INTO plans
			(id, name, cost)
		VALUES
			(${planId}, ${name}, ${cost})`;
}

export async function readPlanById(
	this: DbClient,
	{planId}: IPlanId
): Promise<IPlanEntity> {
	const {rows, rowCount} = await this.parameterisedQuery`
		SELECT id, name, cost
		FROM plans
		WHERE id = ${planId}`;
	return (rowCount > 1) ? rows[0] : null;
}
