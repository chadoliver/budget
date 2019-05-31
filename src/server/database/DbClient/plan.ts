import {DbClient} from '.';

export interface IPlanId {
	planId: string;
}

export interface IPlan extends IPlanId {
	name: string;
	cost: number;
}

export async function createPlan(
	this: DbClient,
	{planId, name, cost}: IPlan
): Promise<void> {
	await this.parameterisedQuery`
		INSERT INTO plans
			(id, name, cost)
		VALUES
			(${planId}, ${name}, ${cost})`;
}
