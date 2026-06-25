"""create sighting image table

Revision ID: 686452fc1ee7
Revises: 6e45660becda
Create Date: 2026-06-25 07:40:10.903244

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '686452fc1ee7'
down_revision: Union[str, None] = '6e45660becda'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sighting_image",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("sighting_id", sa.BigInteger(), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["sighting_id"], ["sighting.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_sighting_image_sighting_id",
        "sighting_image",
        ["sighting_id"],
        unique=False,
    )

    connection = op.get_bind()

    sighting = sa.table(
        "sighting",
        sa.column("id", sa.BigInteger()),
        sa.column("image_url", sa.String(length=500)),
    )

    sighting_image = sa.table(
        "sighting_image",
        sa.column("sighting_id", sa.BigInteger()),
        sa.column("image_url", sa.String(length=500)),
        sa.column("sort_order", sa.Integer()),
    )

    rows = connection.execute(
        sa.select(sighting.c.id, sighting.c.image_url).where(
            sighting.c.image_url.is_not(None)
        )
    ).fetchall()

    backfill_rows = [
        {
            "sighting_id": row.id,
            "image_url": row.image_url.strip(),
            "sort_order": 0,
        }
        for row in rows
        if row.image_url and row.image_url.strip()
    ]

    if backfill_rows:
        op.bulk_insert(sighting_image, backfill_rows)

    op.alter_column("sighting_image", "sort_order", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_sighting_image_sighting_id", table_name="sighting_image")
    op.drop_table("sighting_image")